import test from "node:test";
import assert from "node:assert/strict";
import { createWebSearchHandler } from "../../src/lib/server/web/search-handler.ts";
import { createWebSearchService } from "../../src/lib/server/web/search-service.ts";
import { createSerpApiProvider, normalizeSerpResponse } from "../../src/lib/server/web/serpapi.ts";
import { WebSearchError } from "../../src/lib/web/errors.ts";
import { webPageSchema } from "../../src/lib/web/schema.ts";
import { discovery, recipeHtml, structuredRecipe, testSource } from "../helpers/web-recipe.ts";
const request = (body: unknown = { query: "Пиле" }) => new Request("http://localhost/api/recipes/search-web", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const provider = (results = [discovery()]) => ({ searchRecipes: async () => ({ results, nextCursor: null }) });
const fetchPage = async (url: string) => ({ html: recipeHtml(), url });
test("web HTTP success returns authorized full canonical recipe and documented attribution", async () => {
  const response = await createWebSearchHandler(createWebSearchService(provider(), [testSource], fetchPage))(request());
  assert.equal(response.status, 200); assert.equal(response.headers.get("Cache-Control"), "no-store");
  const body = await response.json(); assert.equal(body.results[0].access, "complete"); assert.equal(body.results[0].recipe.source.name, testSource.sourceName); assert.equal(body.results[0].permission.evidenceReference, testSource.evidenceReference); assert.equal(webPageSchema.safeParse(body).success, true);
});
for (const [code, status, retryable] of [["CONFIGURATION", 503, false], ["TIMEOUT", 504, true], ["RATE_LIMIT", 429, true], ["QUOTA", 503, false], ["AUTHENTICATION", 503, false], ["INVALID_RESPONSE", 502, true]] as const) test(`web HTTP maps ${code} safely without provider details`, async () => {
  const handler = createWebSearchHandler(async () => { throw new WebSearchError(code, status, retryable); });
  const response = await handler(request()); const body = await response.json();
  assert.equal(response.status, status); assert.equal(body.error.code, code); assert.equal(body.error.retryable, retryable); assert.equal(body.error.stack, undefined);
  if (code === "RATE_LIMIT") assert.equal(response.headers.get("Retry-After"), "60");
});
test("web missing provider key never calls network", async () => {
  let calls = 0; const adapter = createSerpApiProvider("", async () => { calls++; throw Error("No network"); });
  const response = await createWebSearchHandler(createWebSearchService(adapter, [], fetchPage))(request());
  assert.equal(response.status, 503); assert.equal((await response.json()).error.code, "CONFIGURATION"); assert.equal(calls, 0);
});
test("web provider timeout aborts safely and network errors never leak key or URL", async () => {
  const adapter = createSerpApiProvider("synthetic-secret", async (_url, init) => { (init?.signal as AbortSignal).throwIfAborted(); throw new Error("https://serpapi.com/?api_key=synthetic-secret"); });
  const response = await createWebSearchHandler(createWebSearchService(adapter, [], fetchPage))(request());
  assert.equal(response.status, 502); assert.equal((await response.text()).includes("synthetic-secret"), false);
  const signal = AbortSignal.abort(); await assert.rejects(adapter.searchRecipes("Пиле", { signal }), /TIMEOUT/);
});
test("web adapter separates upstream invalid credentials, quota and rate limiting without retries", async () => {
  for (const [status, payload, code] of [[401, {}, "AUTHENTICATION"], [429, { error: "Your account has run out of searches" }, "QUOTA"], [429, { error: "Too many requests" }, "RATE_LIMIT"], [200, { error: "Invalid API key" }, "AUTHENTICATION"], [200, { organic_results: "invalid" }, "INVALID_RESPONSE"]] as const) {
    let calls = 0; const adapter = createSerpApiProvider("synthetic", async () => { calls++; return Response.json(payload, { status }); });
    const response = await createWebSearchHandler(createWebSearchService(adapter, [], fetchPage))(request());
    const body = await response.json(); assert.equal(body.error.code, code); assert.equal(calls, 1); if (code === "QUOTA") assert.equal(body.error.retryable, false);
  }
});
test("web search deduplicates provider results and handles empty results", async () => {
  const duplicate = discovery();
  const handler = createWebSearchHandler(createWebSearchService(provider([duplicate, duplicate]), [], fetchPage));
  assert.equal((await (await handler(request())).json()).results.length, 1);
  const empty = createWebSearchHandler(createWebSearchService(provider([]), [], fetchPage));
  const body = await (await empty(request())).json(); assert.deepEqual(body.results, []); assert.equal(body.nextCursor, null);
});
test("web pagination preserves query, uses provider cursor and does not repeat the initial page", async () => {
  const seen: number[] = [];
  const service = createWebSearchService({ searchRecipes: async (query, options) => { assert.equal(query, "пиле без гъби"); seen.push(options?.start ?? 0); return { results: [discovery(1 + (options?.start ?? 0)), discovery(2 + (options?.start ?? 0))], nextCursor: options?.start ? null : "10" }; } }, [], fetchPage);
  const handler = createWebSearchHandler(service);
  const first = await (await handler(request({ query: "Пиле без гъби" }))).json();
  const next = await (await handler(request({ query: "Пиле без гъби", cursor: first.nextCursor }))).json();
  assert.deepEqual(seen, [0, 10]); assert.equal(next.nextCursor, null); assert.notEqual(first.results[0].id, next.results[0].id);
});
test("blocked source, missing JSON-LD and incomplete servings remain usable metadata-only results", async () => {
  for (const fetcher of [async () => { throw Error("SOURCE_BLOCKED"); }, async (url: string) => ({ url, html: "<p>No Recipe</p>" }), async (url: string) => ({ url, html: recipeHtml({ ...structuredRecipe, recipeYield: undefined }) })]) {
    const response = await createWebSearchHandler(createWebSearchService(provider(), [testSource], fetcher))(request());
    const result = (await response.json()).results[0]; assert.equal(response.status, 200); assert.equal(result.access, "metadata_only"); assert.equal(result.recipe, undefined); assert.ok(result.limitations.length);
  }
});
test("unknown licenses never fetch a page or publish instructions, images or quantities", async () => {
  let fetches = 0;
  const response = await createWebSearchHandler(createWebSearchService(provider(), [], async () => { fetches++; return { url: discovery().url, html: recipeHtml() }; }))(request());
  const result = (await response.json()).results[0]; assert.equal(result.permission.contentPermission, "unknown"); assert.equal(result.access, "metadata_only"); assert.equal(result.recipe, undefined); assert.equal(result.imageUrl, null); assert.equal(fetches, 0);
});
test("one source failure does not suppress a second complete authorized recipe", async () => {
  const response = await createWebSearchHandler(createWebSearchService(provider([discovery(1), discovery(2)]), [testSource], async (url) => { if (url.endsWith("rice-1")) throw Error("Blocked"); return fetchPage(url); }))(request());
  const body = await response.json(); assert.equal(response.status, 200); assert.equal(body.results.length, 2); assert.equal(body.results[0].access, "complete"); assert.equal(body.results[1].access, "metadata_only");
});
test("missing times remain null and constraints cannot silently publish a non-matching recipe", async () => {
  const service = createWebSearchService(provider(), [testSource], async (url) => ({ url, html: recipeHtml({ ...structuredRecipe, totalTime: undefined, prepTime: undefined, cookTime: undefined }) }));
  const response = await createWebSearchHandler(service)(request()); const recipe = (await response.json()).results[0].recipe;
  assert.equal(recipe.minutes, null); assert.equal(recipe.preparation.cookingMinutes, null);
  for (const query of ["Пиле до 10 минути", "Ориз без ориз"]) { const result = await service(query); assert.equal(result.results[0].recipe, undefined); assert.equal(result.results[0].access, "metadata_only"); }
});
test("malformed, oversized, cross-origin and invalid cursor requests fail before provider calls", async () => {
  let calls = 0; const handler = createWebSearchHandler(async () => { calls++; return { results: [], nextCursor: null, limitations: [] }; });
  for (const body of [{ query: "" }, { query: "я".repeat(501) }, { query: "Пиле", apiKey: "bad" }]) assert.equal((await handler(request(body))).status, 400);
  assert.equal((await handler(new Request("http://localhost/api", { method: "POST", headers: { "Content-Type": "application/json", origin: "https://bad.example.org" }, body: '{}' }))).status, 403);
  assert.equal((await handler(new Request("http://localhost/api", { method: "POST", headers: { "Content-Type": "application/json" }, body: "x".repeat(5000) }))).status, 400);
  assert.equal(calls, 0);
  const service = createWebSearchService(provider(), [], fetchPage); await assert.rejects(service("Пиле", "100:0"), /INVALID_REQUEST/);
});
test("unexpected provider exceptions return safe Bulgarian errors", async () => {
  const response = await createWebSearchHandler(async () => { throw Error("private upstream stack secret-token"); })(request());
  assert.equal(response.status, 502); const text = await response.text(); assert.equal(text.includes("secret-token"), false); assert.equal(text.includes("stack"), false); assert.ok(text.includes("Интернет"));
});
test("HTTP process limiter bounds routine request volume", async () => {
  const handler = createWebSearchHandler(async () => ({ results: [], nextCursor: null, limitations: [] }));
  for (let i = 0; i < 30; i++) assert.equal((await handler(request())).status, 200);
  assert.equal((await handler(request())).status, 429);
});
test("unsafe discovery URLs are discarded before any source fetch", async () => {
  const page = normalizeSerpResponse({ organic_results: [{ title: "Unsafe", link: "http://127.0.0.1/secret" }] }); assert.deepEqual(page.results, []);
});
test("SerpApi enforces a response deadline even when a transport ignores abort", async () => {
  let calls = 0;
  const adapter = createSerpApiProvider("synthetic", async () => { calls++; await new Promise((resolve) => setTimeout(resolve, 40)); return Response.json({ organic_results: [] }); }, { timeoutMs: 5 });
  await assert.rejects(adapter.searchRecipes("Пиле"), (error: unknown) => error instanceof WebSearchError && error.code === "TIMEOUT" && error.status === 504);
  assert.equal(calls, 1);
});
test("SerpApi deadline also covers stalled response bodies and maps to safe HTTP 504", async () => {
  let signal: AbortSignal | null | undefined;
  const adapter = createSerpApiProvider("synthetic", async (_input, init) => {
    signal = init?.signal;
    return new Response(new ReadableStream({ start(controller) { setTimeout(() => { controller.enqueue(new TextEncoder().encode('{"organic_results":[]}')); controller.close(); }, 40); } }));
  }, { timeoutMs: 5 });
  const response = await createWebSearchHandler(createWebSearchService(adapter, [], fetchPage))(request());
  assert.equal(response.status, 504); assert.equal((await response.json()).error.code, "TIMEOUT");
  assert.equal((signal as AbortSignal | undefined)?.aborted, true);
});
