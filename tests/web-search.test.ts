import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildSearchQuery, normalizeWebQuery, webQueryIntent } from "../src/lib/web/query.ts";
import { canonicalRecipeUrl, isPublicAddress, publicRecipeUrl, webRecipeId } from "../src/lib/web/url.ts";
import { classifyPermission } from "../src/lib/web/permissions.ts";
import { extractRecipe, extractInstructions, isoMinutes, parseWebIngredient } from "../src/lib/web/extract.ts";
import { normalizeSerpResponse, createSerpApiProvider } from "../src/lib/server/web/serpapi.ts";
import { validatePublicTarget, fetchAuthorizedPage } from "../src/lib/server/web/secure-fetch.ts";
import { createWebSearchService } from "../src/lib/server/web/search-service.ts";
import { BoundedCache } from "../src/lib/web/cache.ts";
import { webPageSchema, webRecipeSchema } from "../src/lib/web/schema.ts";
import { matchesLiveFilters } from "../src/lib/web/filters.ts";
import { formatIngredientAmount, scaleIngredients } from "../src/lib/servings.ts";
import { readGeneratedEntries, saveGeneratedRecipe } from "../src/lib/ai/recipe-store.ts";
import { discovery, recipeHtml, structuredRecipe, testSource, webResult } from "./helpers/web-recipe.ts";
test("web query normalization preserves Bulgarian Unicode and canonical cache keys", () => {
  assert.equal(normalizeWebQuery("  ПИЛЕ\n с  ориз  "), "пиле с ориз");
  assert.equal(normalizeWebQuery("Мусака"), normalizeWebQuery(" мусака "));
  assert.match(buildSearchQuery("Какво да сготвя с пилешко?"), /пилешко\? рецепта$/u);
});
test("full query constraints survive provider query construction", () => {
  for (const query of ["Паста без гъби", "Веган вечеря до 30 минути", "Българска кухня без лактоза", "Свинско с картофи на фурна"]) assert.equal(buildSearchQuery(query), `${normalizeWebQuery(query)} рецепта`);
  assert.equal(webQueryIntent("Пиле без лук за 6 порции до 30 минути").maxMinutes, 30);
});
test("SerpApi response validation rejects malformed external data", () => {
  for (const data of [null, {}, { organic_results: "fake" }, { organic_results: [{ title: 1, link: "x" }] }]) assert.throws(() => normalizeSerpResponse(data), /INVALID_RESPONSE/);
  assert.deepEqual(normalizeSerpResponse({ search_metadata: { status: "Success" } }).results, []);
});
test("canonical duplicate removal ignores tracking, amp, www and fragments", () => {
  const result = normalizeSerpResponse({ organic_results: ["https://food.example.org/rice?utm_source=x#x", "https://www.food.example.org/rice/amp/", "https://food.example.org/rice?print=1"].map((link) => ({ title: "Ориз", link })) });
  assert.equal(result.results.length, 1);
  assert.equal(webRecipeId("http://www.food.example.org/rice/"), result.results[0].id);
  assert.equal(canonicalRecipeUrl("https://food.example.org/rice?b=2&a=1"), "https://food.example.org/rice?a=1&b=2");
});
test("live Google recipe aliases with fb_comment_id resolve to one stable recipe", () => {
  const url = "https://zvezdev.com/рецепта/пиле-с-ориз";
  const page = normalizeSerpResponse({ organic_results: [{ title: "Пиле с ориз", link: `${url}?fb_comment_id=123_456` }, { title: "Пиле с ориз", link: url }] });
  assert.equal(page.results.length, 1);
  assert.equal(webRecipeId(`${url}?fb_comment_id=123_456`), webRecipeId(url));
});
test("URL validation rejects unsafe protocols, credentials, ports and internal hosts", () => {
  for (const url of ["javascript:alert(1)", "file:///etc/passwd", "http://localhost/a", "http://127.1/a", "http://2130706433/a", "http://[::1]/a", "https://x.internal/a", "https://user:pw@example.org", "https://example.org:444/a", "https://example.org/?api_key=secret", "http://169.254.169.254/"]) assert.throws(() => publicRecipeUrl(url));
  assert.equal(publicRecipeUrl("https://food.example.org/rice#x"), "https://food.example.org/rice");
});
test("SSRF public address validation handles mapped IPv6 and reserved networks", () => {
  for (const ip of ["10.0.0.1", "172.16.1.1", "192.168.1.1", "100.64.0.1", "0.0.0.0", "::ffff:127.0.0.1", "fe80::1", "fc00::1", "224.0.0.1", "::"]) assert.equal(isPublicAddress(ip), false, ip);
  assert.equal(isPublicAddress("8.8.8.8"), true);
});
test("DNS validation rejects any private answer and pins only public destinations", async () => {
  await assert.rejects(validatePublicTarget(testSource.origin, async () => [{ address: "8.8.8.8", family: 4 }, { address: "10.0.0.1", family: 4 }]), /UNSAFE_URL/);
  assert.equal((await validatePublicTarget(testSource.origin, async () => [{ address: "8.8.8.8", family: 4 }])).address.address, "8.8.8.8");
});
test("secure fetch reauthorizes redirects, bounds redirects and response sizes", async () => {
  const options = { lookup: async () => [{ address: "8.8.8.8", family: 4 }] };
  let calls = 0;
  await assert.rejects(fetchAuthorizedPage(discovery().url, (url) => url.startsWith(testSource.origin), { ...options, transport: async (_url, pinned) => { calls++; assert.equal(pinned.address, "8.8.8.8"); return { status: 302, location: "https://other.example.org/rice", html: "", contentType: "" }; } }), /SOURCE_NOT_AUTHORIZED/);
  assert.equal(calls, 1);
  await assert.rejects(fetchAuthorizedPage(discovery().url, () => true, { ...options, transport: async () => ({ status: 302, location: discovery().url, html: "", contentType: "" }) }), /SOURCE_REDIRECT_LIMIT/);
  await assert.rejects(fetchAuthorizedPage(discovery().url, () => true, { ...options, transport: async () => ({ status: 200, html: "я".repeat(600000), contentType: "text/html" }) }), /SOURCE_TOO_LARGE/);
  await assert.rejects(fetchAuthorizedPage(discovery().url, () => true, { ...options, transport: async () => ({ status: 403, html: "", contentType: "text/html" }) }), /SOURCE_BLOCKED/);
});
test("JSON-LD graph/arrays are read without executing webpage scripts", () => {
  const extracted = extractRecipe(recipeHtml([{ "@type": "WebPage" }, { "@graph": [structuredRecipe] }]))!;
  assert.equal(extracted.title, structuredRecipe.name); assert.equal(extracted.steps.length, 2); assert.equal(extracted.servings, 4);
  assert.equal(extracted.imageUrl, structuredRecipe.image);
});
test("invalid JSON-LD, non-recipe and incomplete structured data stay incomplete", () => {
  assert.equal(extractRecipe('<script type="application/ld+json">{bad}</script>'), null);
  assert.equal(extractRecipe(recipeHtml({ "@type": "Recipe", name: 9 })), null);
  const extracted = extractRecipe(recipeHtml({ "@type": "Recipe", name: "Непълна" }))!;
  assert.equal(extracted.minutes, null); assert.equal(extracted.servings, null); assert.equal(extracted.steps.length, 0);
});
test("ISO durations preserve fractional minutes and distinguish absent from explicit zero", () => {
  for (const [input, value] of [["PT1H30M", 90], ["PT30S", .5], ["P1DT2H", 1560], ["PT0M", 0], ["P", null], ["PT", null], ["P1M", null], ["PT-1M", null], [undefined, null]] as const) assert.equal(isoMinutes(input), value);
});
test("ingredient parsing handles metric quantities, fractions, tablespoons and pieces", () => {
  for (const [input, quantity, unit] of [["300 г ориз", 300, "g"], ["0,5 кг картофи", .5, "kg"], ["1 1/2 с.л. зехтин", 1.5, "tbsp"], ["½ ч.л. сол", .5, "tsp"], ["2 яйца", 2, "piece"], ["250 мл вода", 250, "ml"], ["1 л вода", 1, "l"]] as const) { const i = parseWebIngredient(input); assert.equal(i.quantity, quantity, input); assert.equal(i.unit, unit); assert.equal(i.originalText, input); }
});
test("ambiguous or missing ingredient quantities are retained without fabricated scaling", () => {
  for (const input of ["сол на вкус", "1-2 чаши ориз", "1 cup rice", "1/0 г ориз", "щипка черен пипер"]) { const i = parseWebIngredient(input); assert.equal(i.quantity, null); assert.equal(i.unit, null); assert.equal(i.originalText, input); assert.equal(i.quantityStatus, "unparsed"); assert.match(formatIngredientAmount(i), /не се преизчислява/u); assert.deepEqual(scaleIngredients([i], 4, 6), [i]); }
});
test("HowToStep/HowToSection and graph references preserve ordered instructions", () => {
  assert.equal(extractInstructions(structuredRecipe.recipeInstructions)[0].title, "Подготви ориза");
  assert.equal(extractInstructions(structuredRecipe.recipeInstructions)[1].durationMinutes, 1);
  assert.equal(extractInstructions({ "@type": "HowToStep", text: "Стъпка", duration: "PT0S" })[0].durationMinutes, undefined);
  const extracted = extractRecipe(recipeHtml({ "@graph": [{ ...structuredRecipe, recipeInstructions: [{ "@id": "#step" }] }, { "@id": "#step", "@type": "HowToStep", text: "От графа" }] }))!;
  assert.equal(extracted.steps[0].description, "От графа");
});
test("permission requires documented matching registry and denies sibling paths, expiry and unknown licenses", () => {
  assert.equal(classifyPermission(discovery().url, []).contentPermission, "unknown");
  assert.equal(classifyPermission(discovery().url, [testSource]).contentPermission, "authorized");
  assert.equal(classifyPermission(`${testSource.origin}/recipes-other/a`, [testSource]).contentPermission, "unknown");
  assert.equal(classifyPermission(discovery().url, [{ ...testSource, evidenceReference: "" }]).contentPermission, "unknown");
  assert.equal(classifyPermission(discovery().url, [{ ...testSource, expiresAt: 1 }]).contentPermission, "unknown");
});
test("authorized canonical recipe preserves attribution and never publishes unauthorized images", () => {
  const result = webResult(); assert.equal(webRecipeSchema.safeParse(result.recipe).success, true);
  assert.equal(result.recipe!.source?.kind, "web"); assert.equal(result.recipe!.imageUrl, null); assert.equal(result.recipe!.difficulty, null);
  assert.equal(webPageSchema.safeParse({ results: [result], nextCursor: null, limitations: [] }).success, true);
  assert.equal(webRecipeSchema.safeParse({ ...result.recipe, source: { ...result.recipe!.source, reuse: classifyPermission(discovery().url, []) } }).success, false);
});
test("metadata-only envelopes cannot smuggle a complete recipe or a third-party photograph", () => {
  const result = webResult(1, false);
  assert.equal(webPageSchema.safeParse({ results: [{ ...result, recipe: webResult().recipe }], nextCursor: null, limitations: [] }).success, false);
  assert.equal(webPageSchema.safeParse({ results: [{ ...result, imageUrl: structuredRecipe.image }], nextCursor: null, limitations: [] }).success, false);
});
test("bounded cache evicts old entries, expires values and refuses oversized data", () => {
  let now = 0; const cache = new BoundedCache<string>(2, 100, 20, () => now);
  cache.set("a", "one"); cache.set("b", "two"); cache.set("c", "three"); assert.equal(cache.get("a"), undefined); assert.equal(cache.get("b"), "two");
  cache.set("large", "x".repeat(100)); assert.equal(cache.get("large"), undefined);
  now = 100; assert.equal(cache.get("b"), undefined); assert.throws(() => new BoundedCache(0));
});
test("service caches normalized queries, coalesces requests and paginates real provider pages", async () => {
  let calls = 0; const starts: number[] = [];
  const search = createWebSearchService({ searchRecipes: async (_query, options) => { calls++; starts.push(options?.start ?? 0); return { results: Array.from({ length: 4 }, (_, i) => discovery(i + 1 + (options?.start ?? 0))), nextCursor: options?.start ? null : "10" }; } }, [], async () => { throw Error("Unauthorized fetch"); });
  const [first, same] = await Promise.all([search(" ПИЛЕ "), search("пиле")]); assert.deepEqual(first, same); assert.equal(calls, 1); assert.equal(first.results.length, 2); assert.equal(first.nextCursor, "0:2");
  const second = await search("Пиле", first.nextCursor); assert.equal(calls, 1); assert.equal(second.nextCursor, "10:0");
  const third = await search("Пиле", second.nextCursor); assert.equal(calls, 2); assert.deepEqual(starts, [0, 10]); assert.notEqual(third.results[0].id, first.results[0].id);
  await assert.rejects(search("Пиле", "https://bad.example.org?key=secret"), /INVALID_REQUEST/);
});
test("metadata-only filtering never treats unknown times or difficulty as known", () => {
  const all = { time: "all", difficulty: "all", cuisine: "all", category: "all" } as const;
  assert.equal(matchesLiveFilters(undefined, all), true);
  assert.equal(matchesLiveFilters(undefined, { ...all, time: "quick" }), false);
  assert.equal(matchesLiveFilters(webResult().recipe, { ...all, time: "quick" }), true);
  assert.equal(matchesLiveFilters(webResult().recipe, { ...all, difficulty: "Лесна" }), false);
});
test("existing temporary recipe store supports authorized web records and rejects tampered provenance", () => {
  let raw: string | null = null; const storage = { getItem: () => raw, setItem: (_key: string, value: string) => { raw = value; } };
  assert.equal(saveGeneratedRecipe(storage, webResult().recipe!, "web-query", 1700000000000), true);
  assert.equal(readGeneratedEntries(raw, 1700000000001).length, 1);
  assert.equal(readGeneratedEntries(raw, 1700000000000 + 600001).length, 0);
  const parsed = JSON.parse(raw!); parsed[0].recipe.source.reuse.evidenceReference = null;
  assert.equal(readGeneratedEntries(JSON.stringify(parsed), 1700000000001).length, 0);
});
test("provider adapter uses fixed Google endpoint and Bulgarian options without propagating credential URLs", async () => {
  const provider = createSerpApiProvider("synthetic-key", async (input, init) => {
    const url = new URL(String(input)); assert.equal(url.origin, "https://serpapi.com"); assert.equal(url.searchParams.get("hl"), "bg"); assert.equal(url.searchParams.get("gl"), "bg"); assert.equal(url.searchParams.get("start"), "10"); assert.match(url.searchParams.get("q")!, /без гъби/u); assert.equal(init?.redirect, "error");
    return Response.json({ organic_results: [{ title: "Паста", link: "https://food.example.org/pasta" }], serpapi_pagination: { next: "https://serpapi.com/search?api_key=synthetic-key" } });
  });
  const page = await provider.searchRecipes("Паста без гъби", { start: 10 }); assert.equal(page.nextCursor, "20"); assert.equal(JSON.stringify(page).includes("synthetic-key"), false);
});
test("sanitized live discovery replays retain 37 unique metadata-only links without licenses or full recipes", () => {
  const fixture = JSON.parse(readFileSync(new URL("./fixtures/live-web-search.json", import.meta.url), "utf8"));
  assert.equal(fixture.requests, 5); assert.equal(fixture.queries.length, 5);
  let total = 0;
  for (const query of fixture.queries) {
    const ids = new Set<string>();
    for (const page of query.pages) {
      const parsed = webPageSchema.parse(page);
      for (const result of parsed.results) {
        assert.equal(result.access, "metadata_only"); assert.equal(result.permission.contentPermission, "unknown");
        assert.equal(result.recipe, undefined); assert.equal(result.imageUrl, null); assert.equal(result.description, "");
        assert.equal(result.permission.licenseReference, null); assert.equal(ids.has(result.id), false); ids.add(result.id); total++;
      }
    }
    assert.equal(query.pages.at(-1).nextCursor, null);
  }
  assert.equal(total, 37);
});
