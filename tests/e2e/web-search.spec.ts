import { test, expect } from "./fixtures";
import { aiRecipe } from "../helpers/ai-recipe";
import { webResult } from "../helpers/web-recipe";
import { generatedStoreKey } from "../../src/lib/ai/recipe-store";
test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: "recipe-search-mode", value: "ai", url: baseURL! }]);
});
for (const query of ["Мусака", "Пиле с ориз", "Имам картофи, яйца и сирене"]) test(`combined AI and web search: ${query}`, async ({ page }) => {
  await page.route("**/api/recipes/generate", (route) => route.fulfill({ json: { recipe: aiRecipe(4, `AI: ${query}`) } }));
  await page.route("**/api/recipes/search-web", (route) => { expect(route.request().postDataJSON()).toEqual({ query, cursor: null }); return route.fulfill({ json: { results: [webResult(1), webResult(2)], nextCursor: null, limitations: [] } }); });
  await page.goto(`/search?q=${encodeURIComponent(query)}`);
  await expect(page.getByRole("article")).toHaveCount(3);
  await expect(page.getByRole("article").getByText("AI рецепта", { exact: true })).toHaveCount(1);
  await expect(page.getByRole("article").getByText("От интернет", { exact: true })).toHaveCount(2);
  await expect(page.getByRole("article").getByText("Синтетичен тестов източник", { exact: true })).toHaveCount(2);
  const aiBadge = page.getByRole("article").getByText("AI рецепта", { exact: true });
  const webBadge = page.getByRole("article").getByText("От интернет", { exact: true }).first();
  expect(await aiBadge.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(40, 89, 67)");
  expect(await webBadge.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(227, 97, 35)");
  await expect(page.getByRole("button", { name: "Покажи още рецепти" })).toBeDisabled();
});
for (const width of [1440, 375]) test(`complete authorized web journey with refresh and history at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 900 }); const result = webResult(1, true, "Интернет пиле с ориз"); let aiCalls = 0;
  await page.route("**/api/recipes/generate", (route) => { aiCalls++; return route.fulfill({ json: { recipe: aiRecipe() } }); });
  await page.route("**/api/recipes/search-web", (route) => route.fulfill({ json: { results: [result, webResult(2)], nextCursor: null, limitations: [] } }));
  await page.goto("/"); await page.getByRole("searchbox").fill("Пиле с ориз"); await page.getByRole("searchbox").press("Enter");
  await expect(page.getByRole("article")).toHaveCount(3);
  await page.screenshot({ path: testInfo.outputPath(`combined-search-${width}.png`), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("heading", { name: result.title, exact: true }).getByRole("link").click();
  await expect(page).toHaveURL(new RegExp(`/recipes/${result.id}$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(result.title);
  await expect(page.getByText("Рецепта от интернет", { exact: true }).first()).toBeVisible();
  const rice = page.getByRole("checkbox", { name: /ориз/u });
  await expect(rice.locator("..")).toContainText("300 г");
  await page.getByRole("button", { name: "Увеличи порциите" }).click();
  await expect(rice.locator("..")).toContainText("375 г"); await rice.check();
  await page.reload(); await expect(rice).toBeChecked();
  await page.getByRole("link", { name: "Започни да готвиш" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Готвим: ${result.title}`);
  if (width === 375) await page.getByRole("button", { name: "Продукти", exact: true }).click();
  await expect(rice).toBeChecked(); await expect(rice.locator("..")).toContainText("375 г");
  await page.getByRole("button", { name: /следваща/u }).click();
  await page.getByRole("button", { name: "Старт на таймера" }).click();
  await page.reload(); await expect(page.getByRole("button", { name: "Пауза на таймера" })).toBeEnabled();
  await page.getByRole("link", { name: "Изход" }).click(); await expect(page).toHaveURL(new RegExp(`/recipes/${result.id}$`)); await expect(rice).toBeChecked();
  await page.goBack(); await expect(page.getByRole("heading", { level: 1 })).toContainText("Готвим:");
  await page.goForward(); await expect(page.getByRole("heading", { level: 1 })).toHaveText(result.title);
  await page.getByRole("link", { name: "Започни да готвиш" }).click(); await page.getByRole("button", { name: "Завърши готвенето" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Браво! Ястието е готово!");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); expect(aiCalls).toBe(1);
});
test("metadata-only result uses original link, never unauthorized text or images", async ({ page, context }) => {
  const metadata = webResult(1, false, "Само оригинален източник");
  await page.route("**/api/recipes/generate", (route) => route.fulfill({ json: { recipe: aiRecipe() } }));
  await page.route("**/api/recipes/search-web", (route) => route.fulfill({ json: { results: [metadata], nextCursor: null, limitations: [] } }));
  await context.route(metadata.url, (route) => route.fulfill({ contentType: "text/html", body: "<h1>Оригинален сайт — синтетичен тест</h1>" }));
  await page.goto("/search?mode=ai&q=ориз"); const card = page.getByRole("article").filter({ has: page.getByRole("heading", { name: metadata.title }) });
  await expect(card.getByRole("link", { name: "Отвори оригинала", exact: true })).toHaveAttribute("href", metadata.url);
  await expect(card.getByRole("link", { name: "Отвори оригинала", exact: true })).toHaveAttribute("rel", "noopener noreferrer");
  await expect(card.getByRole("link", { name: /Виж рецептата/u })).toHaveCount(0);
  await expect(card).not.toContainText("Измери тестовите продукти");
  expect(await page.locator('img[src*="photos.example.org"]').count()).toBe(0);
  const popupEvent = page.waitForEvent("popup"); await card.getByRole("link", { name: "Отвори оригинала", exact: true }).click();
  const popup = await popupEvent; await expect(popup).toHaveURL(metadata.url); await popup.close();
  const raw = await page.evaluate((key) => sessionStorage.getItem(key), generatedStoreKey); expect(raw).not.toContain(metadata.id);
});
test("incremental pages preserve filters, deduplicate and never restart AI", async ({ page }) => {
  let aiCalls = 0, webCalls = 0; const queries: unknown[] = [];
  await page.route("**/api/recipes/generate", (route) => { aiCalls++; return route.fulfill({ json: { recipe: aiRecipe() } }); });
  await page.route("**/api/recipes/search-web", (route) => {
    webCalls++; const body = route.request().postDataJSON(); queries.push(body);
    return route.fulfill({ json: { results: body.cursor ? [webResult(1), webResult(3)] : [webResult(1), webResult(2)], nextCursor: body.cursor ? null : "10:0", limitations: [] } });
  });
  await page.goto("/search?mode=ai&q=Пиле"); await expect(page.getByRole("article")).toHaveCount(3);
  await page.getByRole("button", { name: "До 30 мин", exact: true }).click();
  const more = page.getByRole("button", { name: "Покажи още рецепти" }); await more.click();
  await expect(page.getByRole("article")).toHaveCount(4); await expect(more).toBeDisabled();
  await expect(page.getByRole("button", { name: "До 30 мин", exact: true })).toHaveAttribute("aria-pressed", "true");
  expect(queries).toEqual([{ query: "Пиле", cursor: null }, { query: "Пиле", cursor: "10:0" }]); expect(aiCalls).toBe(1); expect(webCalls).toBe(2);
  await expect(page.getByRole("heading", { name: webResult(1).title, exact: true })).toHaveCount(1);
});
for (const [aiFails, webFails] of [[false, true], [true, false], [true, true]] as const) test(`independent partial failures AI=${aiFails} web=${webFails}`, async ({ page }) => {
  await page.route("**/api/recipes/generate", (route) => route.fulfill(aiFails ? { status: 503, json: { error: { code: "INSUFFICIENT_QUOTA", retryable: false } } } : { json: { recipe: aiRecipe() } }));
  await page.route("**/api/recipes/search-web", (route) => route.fulfill(webFails ? { status: 503, json: { error: { code: "QUOTA", retryable: true, message: "private provider secret" } } } : { json: { results: [webResult()], nextCursor: null, limitations: [] } }));
  await page.goto("/search?mode=ai&q=Пиле");
  await expect(page.getByRole("article")).toHaveCount(aiFails && webFails ? 0 : 1);
  if (aiFails) await expect(page.getByRole("region", { name: "AI рецепта" }).getByRole("alert")).toBeVisible();
  if (webFails) { await expect(page.getByRole("region", { name: "Интернет търсене" }).getByRole("alert")).toContainText("изчерпан"); await expect(page.getByRole("button", { name: "Опитай интернет търсенето отново" })).toHaveCount(0); }
  await expect(page.getByRole("main")).not.toContainText("private provider secret");
});
test("web loading and retry states stay independent of AI and preserve results after pagination errors", async ({ page }) => {
  let release!: () => void; const gate = new Promise<void>((resolve) => { release = resolve; }); let requests = 0;
  await page.route("**/api/recipes/generate", (route) => route.fulfill({ json: { recipe: aiRecipe() } }));
  await page.route("**/api/recipes/search-web", async (route) => { requests++; if (requests === 1) { await gate; return route.fulfill({ json: { results: [webResult()], nextCursor: "10:0", limitations: [] } }); } if (requests === 2) return route.fulfill({ status: 504, json: { error: { code: "TIMEOUT", retryable: true } } }); return route.fulfill({ json: { results: [webResult(2)], nextCursor: null, limitations: [] } }); });
  await page.goto("/search?mode=ai&q=Пиле");
  await expect(page.getByRole("region", { name: "Интернет търсене" })).toHaveAttribute("aria-busy", "true");
  await expect(page.getByRole("region", { name: "Интернет търсене" }).getByRole("status")).toContainText("Търсим");
  await expect(page.getByRole("article")).toHaveCount(1); release();
  await expect(page.getByRole("article")).toHaveCount(2);
  await page.getByRole("button", { name: "Покажи още рецепти" }).click();
  await expect(page.getByRole("region", { name: "Интернет търсене" }).getByRole("alert")).toContainText("твърде дълго");
  await expect(page.getByRole("article")).toHaveCount(2);
  await page.getByRole("button", { name: "Опитай интернет търсенето отново" }).click();
  await expect(page.getByRole("article")).toHaveCount(3); await expect(page.getByRole("region", { name: "Интернет търсене" }).getByRole("alert")).toHaveCount(0);
});
test("empty, malformed and unauthorized full responses never create fake internal recipes", async ({ page }) => {
  await page.route("**/api/recipes/generate", (route) => route.fulfill({ status: 503, json: { error: { code: "INSUFFICIENT_QUOTA", retryable: false } } }));
  let mode = "empty";
  await page.route("**/api/recipes/search-web", (route) => route.fulfill({ json: mode === "empty" ? { results: [], nextCursor: null, limitations: [] } : mode === "malformed" ? { results: [{ title: "Невалидна рецепта" }] } : { results: [{ ...webResult(1, false), access: "complete", recipe: webResult().recipe }], nextCursor: null, limitations: [] } }));
  await page.goto("/search?mode=ai&q=празно"); await expect(page.getByText("Няма интернет резултати за тази заявка.")).toBeVisible();
  for (const value of ["malformed", "unauthorized"]) { mode = value; await page.goto(`/search?mode=ai&q=${value}`); await expect(page.getByRole("region", { name: "Интернет търсене" }).getByRole("alert")).toContainText("невалидни резултати"); await expect(page.getByRole("article")).toHaveCount(0); }
});
test("mobile filters are keyboard-accessible and exclude unknown metadata, cuisine and category", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await page.route("**/api/recipes/generate", (route) => route.fulfill({ json: { recipe: aiRecipe() } }));
  await page.route("**/api/recipes/search-web", (route) => route.fulfill({ json: { results: [webResult(), webResult(2, false)], nextCursor: null, limitations: [] } }));
  await page.goto("/search?mode=ai&q=ориз"); await expect(page.getByRole("article")).toHaveCount(3);
  const quick = page.getByRole("button", { name: "До 30 мин", exact: true }); await quick.focus(); await page.keyboard.press("Enter"); await expect(page.getByRole("article")).toHaveCount(2);
  await page.getByRole("button", { name: /Допълнителни филтри/u }).click();
  await page.getByRole("combobox", { name: "Сложност", exact: true }).selectOption("Лесна"); await expect(page.getByRole("article")).toHaveCount(1);
  await page.getByRole("combobox", { name: "Кухня", exact: true }).selectOption("Българска кухня"); await page.getByRole("combobox", { name: "Тип ястие", exact: true }).selectOption("Основни ястия");
  await page.getByRole("button", { name: "Над 60 мин", exact: true }).click(); await expect(page.getByText("Няма рецепти с тези филтри.")).toBeVisible();
  await page.getByRole("button", { name: "Всички", exact: true }).click(); await expect(page.getByRole("article")).toHaveCount(3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test("expired web records recover safely and metadata-only IDs cannot enter cooking mode", async ({ page }) => {
  const result = webResult(); await page.goto("/");
  await page.evaluate(({ key, recipe }) => sessionStorage.setItem(key, JSON.stringify([{ recipe, queryKey: "web", expiresAt: 1 }])), { key: generatedStoreKey, recipe: result.recipe });
  for (const suffix of ["", "/cook"]) { await page.goto(`/recipes/${result.id}${suffix}`); await expect(page.getByRole("heading", { name: "Интернет рецептата не е налична" })).toBeVisible(); await expect(page.getByRole("link", { name: "Започни да готвиш" })).toHaveCount(0); }
});
test("real web endpoint handles missing configuration without provider credits", async ({ request }) => {
  const response = await request.post("/api/recipes/search-web", { data: { query: "Мусака" } }); expect(response.status()).toBe(503); expect((await response.json()).error.code).toBe("CONFIGURATION");
});

for (const width of [1440, 375]) test(`missing web configuration keeps AI independent and hides provider details at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let webCalls = 0, aiCalls = 0;
  const sentinel = "synthetic-provider-secret-not-a-real-key";
  await page.route("**/api/recipes/generate", async (route) => {
    aiCalls++; await gate; await route.fulfill({ json: { recipe: aiRecipe() } });
  });
  await page.route("**/api/recipes/search-web", (route) => {
    webCalls++;
    expect(route.request().postDataJSON()).toEqual({ query: "Мусака", cursor: null });
    return route.fulfill({ status: 503, json: { error: { code: "CONFIGURATION", retryable: true, message: sentinel } } });
  });
  await page.goto("/search?mode=ai&q=Мусака");
  const web = page.getByRole("region", { name: "Интернет търсене" });
  const ai = page.getByRole("region", { name: "AI рецепта" });
  await expect(web.getByRole("alert")).toContainText("Интернет търсенето още не е настроено");
  await expect(ai).toHaveAttribute("aria-busy", "true");
  await expect(ai.getByRole("status")).toContainText("Създаваме");
  await expect(page.getByRole("button", { name: "Опитай интернет търсенето отново" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Покажи още рецепти" })).toBeDisabled();
  await expect(page.getByRole("article")).toHaveCount(0);
  release();
  await expect(ai.getByRole("article")).toHaveCount(1);
  await expect(ai.getByRole("article").getByText("AI рецепта", { exact: true })).toBeVisible();
  await expect(web.getByRole("alert")).toBeVisible();
  await expect(page.getByRole("article").getByText("От интернет", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("main")).not.toContainText(sentinel);
  expect(await page.evaluate((value) => `${sessionStorage.getItem("aichef:generated:v1") ?? ""}${document.documentElement.outerHTML}`.includes(value), sentinel)).toBe(false);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.clock.install(); await page.clock.runFor(60001);
  expect(webCalls).toBe(1); expect(aiCalls).toBe(1);
});
