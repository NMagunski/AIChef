import { test, expect } from "./fixtures";
import { aiRecipe, modelRecipe } from "../helpers/ai-recipe";
import { normalizeRecipe } from "../../src/lib/ai/recipe-schema";
import { generatedStoreKey } from "../../src/lib/ai/recipe-store";

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: "recipe-search-mode", value: "ai", url: baseURL! }]);
});

for (const [query, title, servings] of [
  ["Мусака", "Мусака", 4], ["Пиле с ориз", "Пиле с ориз", 4],
  ["Имам картофи, яйца и сирене", "Картофи с яйца и сирене", 4],
  ["Рецепта без лук и гъби", "Пиле с ориз без лук и гъби", 4],
  ["Бърза вечеря до 30 минути", "Бързо пиле с ориз", 4], ["Пиле с ориз за 6 човека", "Пиле с ориз", 6],
] as const) test(`AI functional search: ${query}`, async ({ page }) => {
  const raw = modelRecipe({ title, servings });
  raw.ingredients[0].quantity = servings * 200; raw.ingredients[1].quantity = servings * 75;
  if (query.startsWith("Имам")) {
    raw.ingredients = [{ name: "Картофи", quantity: 800, unit: "g", note: null, availability: "available" }, { name: "Яйца", quantity: 4, unit: "piece", note: null, availability: "available" }, { name: "Сирене", quantity: 200, unit: "g", note: null, availability: "available" }];
    raw.instructions.forEach((step) => { step.ingredientIndices = [0, 1, 2]; step.description = "Подготви и сготви картофите с яйцата и сиренето. Провери яйченото ястие с термометър до 71°C."; });
  }
  const recipe = normalizeRecipe(raw, "mock-model");
  let calls = 0;
  await page.route("**/api/recipes/generate", async (route) => {
    expect(route.request().method()).toBe("POST"); expect(route.request().postDataJSON()).toEqual({ query }); calls++;
    await route.fulfill({ json: { recipe } });
  });
  await page.goto(`/search?q=${encodeURIComponent(query)}`);
  const card = page.getByRole("article");
  await expect(card.getByRole("heading", { name: title })).toBeVisible();
  await expect(card.getByText("AI рецепта", { exact: true })).toBeVisible();
  await expect(card).not.toContainText("Демо");
  await expect(card).toContainText(`${servings} порции`);
  expect(calls).toBe(1);
  await card.getByRole("heading", { name: title }).getByRole("link").click();
  await expect(page).toHaveURL(new RegExp(`/recipes/${recipe.id}$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  if (query.startsWith("Имам")) await expect(page.getByRole("checkbox", { name: /Картофи/ }).locator("..")).toContainText("налично според заявката");
});

test("AI loading state and duplicate in-flight form submission are controlled", async ({ page }) => {
  let release!: () => void;
  const wait = new Promise<void>((resolve) => { release = resolve; }); let calls = 0;
  await page.route("**/api/recipes/generate", async (route) => { calls++; await wait; await route.fulfill({ json: { recipe: aiRecipe() } }); });
  await page.goto("/search?q=Пиле");
  await expect(page.getByRole("region", { name: "AI рецепта" }).getByRole("status")).toContainText("Създаваме твоята AI рецепта");
  await expect(page.getByRole("region", { name: "AI рецепта" })).toHaveAttribute("aria-busy", "true");
  await page.getByRole("button", { name: "Търси", exact: true }).click();
  await expect(page.getByRole("region", { name: "AI рецепта" }).getByRole("status")).toContainText("Създаваме");
  release();
  await expect(page.getByRole("article")).toBeVisible(); expect(calls).toBe(1);
});

for (const [code, status, text, retryable] of [
  ["INSUFFICIENT_QUOTA", 503, "изчерпан API кредит", false],
  ["AUTHENTICATION_ERROR", 503, "сървърната конфигурация за достъп", false],
  ["SERVICE_UNAVAILABLE", 503, "AI услугата временно не е достъпна", true],
  ["CONFIGURATION", 503, "AI рецептите още не са настроени", false],
  ["UNAVAILABLE", 503, "AI услугата временно не е достъпна", true],
  ["TIMEOUT", 504, "Генерирането отне твърде дълго", true],
  ["RATE_LIMIT", 429, "Достигнат е лимитът", true],
  ["REFUSED", 422, "Не можем да създадем рецепта", false],
  ["CONSTRAINTS", 422, "Уточни времето и продуктите.", false],
] as const) test(`AI error handling and retry: ${code}`, async ({ page }) => {
  let calls = 0;
  await page.route("**/api/recipes/generate", async (route) => {
    calls++;
    await route.fulfill(calls === 1 ? { status, json: { error: { code, message: code === "CONSTRAINTS" ? text : "Private upstream details must not display", retryable } } } : { json: { recipe: aiRecipe() } });
  });
  await page.goto("/search?q=Пиле");
  await expect(page.getByRole("main").getByRole("alert")).toContainText(text);
  await expect(page.getByRole("main").getByRole("alert")).not.toContainText("Private upstream");
  const retry = page.getByRole("button", { name: "Опитай отново" });
  if (retryable) { await retry.click(); await expect(page.getByRole("article")).toBeVisible(); expect(calls).toBe(2); }
  else { await expect(retry).toHaveCount(0); expect(calls).toBe(1); }
});

test("network failure and malformed successful response do not display fake recipes", async ({ page }) => {
  let calls = 0;
  await page.route("**/api/recipes/generate", async (route) => { calls++; if (calls === 1) await route.abort(); else await route.fulfill({ json: { recipe: { title: "Invalid fake recipe" } } }); });
  await page.goto("/search?q=Пиле");
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Няма връзка със сървъра");
  await page.getByRole("button", { name: "Опитай отново" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("не премина проверките");
  await expect(page.getByRole("article")).toHaveCount(0);
});

test("empty/overlong queries never request generation; demo mode remains available", async ({ page }) => {
  let calls = 0;
  await page.route("**/api/recipes/generate", async (route) => { calls++; await route.abort(); });
  await page.goto("/search"); await expect(page.getByRole("heading", { name: "Какво ти се готви?" })).toBeVisible();
  await page.goto(`/search?q=${"я".repeat(501)}`); await expect(page.getByRole("main").getByRole("alert")).toContainText("1 до 500 знака");
  await page.goto("/search?q=Пиле&mode=demo"); await expect(page.getByText("Демо колекция · локални примерни рецепти.", { exact: false })).toBeVisible(); expect(calls).toBe(0);
});

test("corrupted, expired and missing generated records display a useful recovery page", async ({ page }) => {
  const recipe = aiRecipe();
  await page.goto("/");
  for (const raw of ["{bad-json", JSON.stringify([{ recipe, queryKey: "q", expiresAt: 1 }]), JSON.stringify([{ recipe: { ...recipe, servings: 99 }, queryKey: "q", expiresAt: Date.now() + 100000 }]), "[]"]) {
    await page.evaluate(({ key, raw }) => sessionStorage.setItem(key, raw), { key: generatedStoreKey, raw });
    await page.goto(`/recipes/${recipe.id}`);
    await expect(page.getByRole("heading", { name: "AI рецептата не е налична" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Създай нова рецепта" })).toBeVisible();
    await page.goto(`/recipes/${recipe.id}/cook`);
    await expect(page.getByRole("heading", { name: "AI рецептата не е налична" })).toBeVisible();
  }
});

for (const width of [1440, 375]) test(`full generated recipe journey and persistence at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 900 });
  const recipe = aiRecipe(6);
  let calls = 0;
  await page.route("**/api/recipes/generate", async (route) => { calls++; expect(route.request().postDataJSON().query).toBe("Пиле с ориз за 6 човека"); await route.fulfill({ json: { recipe } }); });
  await page.goto("/");
  await page.getByRole("searchbox").fill("Пиле с ориз за 6 човека");
  await page.getByRole("searchbox").press("Enter");
  await expect(page).toHaveURL(/\/search\?q=/);
  await expect(page.getByRole("article")).toContainText("6 порции");
  await page.screenshot({ path: testInfo.outputPath(`ai-search-${width}.png`), fullPage: true });
  await page.getByRole("heading", { name: "Пиле с ориз", exact: true }).getByRole("link").click();
  const rice = page.getByRole("checkbox", { name: /Ориз/ });
  await expect(rice.locator("..")).toContainText("450 г");
  await page.getByRole("button", { name: "Увеличи порциите" }).click();
  await expect(rice.locator("..")).toContainText("525 г");
  await rice.check();
  await page.screenshot({ path: testInfo.outputPath(`ai-details-${width}.png`), fullPage: true });
  await page.getByRole("link", { name: "Започни да готвиш" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Готвим: Пиле с ориз");
  if (width === 375) await page.getByRole("button", { name: "Продукти", exact: true }).click();
  await expect(rice).toBeChecked();
  await expect(rice.locator("..")).toContainText("525 г");
  await page.getByRole("button", { name: /следваща/ }).click();
  await page.getByRole("button", { name: "Старт на таймера" }).click();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Сготви ястието", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Пауза на таймера" })).toBeEnabled();
  await page.getByRole("link", { name: "Изход" }).click();
  await expect(rice).toBeChecked();
  await expect(page.getByRole("group", { name: "Брой порции" })).toContainText("7 порции");
  await page.goBack();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Готвим: Пиле с ориз");
  await page.goForward();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Пиле с ориз");
  await page.getByRole("link", { name: "Започни да готвиш" }).click();
  await page.getByRole("button", { name: "Завърши готвенето" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Браво! Ястието е готово!");
  await expect(page.getByRole("heading", { level: 2 })).toHaveText("Пиле с ориз");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(calls).toBe(1);
});

test("actual server endpoint rejects bad bodies and missing configuration without external calls", async ({ request }) => {
  const bad = await request.post("/api/recipes/generate", { data: { query: "" } }); expect(bad.status()).toBe(400);
  const missing = await request.post("/api/recipes/generate", { data: { query: "Мусака" } }); expect(missing.status()).toBe(503);
  expect((await missing.json()).error.code).toBe("CONFIGURATION");
});

test("generated favorites and successful-query cache reuse the canonical recipe", async ({ page }) => {
  const recipe = aiRecipe(); let calls = 0;
  await page.route("**/api/recipes/generate", async (route) => { calls++; await route.fulfill({ json: { recipe } }); });
  await page.goto("/search?q=Пиле");
  await page.getByRole("button", { name: "Добави в любими: Пиле с ориз" }).click();
  await page.getByRole("navigation", { name: "Основна навигация" }).getByRole("link", { name: "Любими" }).click();
  await expect(page.getByRole("heading", { name: "Пиле с ориз", exact: true })).toBeVisible();
  await page.goto("/search?q=Пиле");
  await expect(page.getByRole("article")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("article")).toBeVisible(); expect(calls).toBe(1);
});

test("blocked temporary storage prevents a broken generated-recipe link", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, "sessionStorage", { get() { throw new Error("Storage blocked"); } }));
  await page.route("**/api/recipes/generate", (route) => route.fulfill({ json: { recipe: aiRecipe() } }));
  await page.goto("/search?q=Пиле");
  await expect(page.getByRole("main").getByRole("alert")).toContainText("не позволява временно запазване");
  await expect(page.getByRole("article")).toHaveCount(0);
});

for (const code of ["INSUFFICIENT_QUOTA", "AUTHENTICATION_ERROR"]) test(`non-recoverable ${code} suppresses even an erroneous retry flag on mobile`, async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  let calls = 0;
  await page.route("**/api/recipes/generate", (route) => { calls++; return route.fulfill({ status: 503, json: { error: { code, message: "Internal provider details", retryable: true } } }); });
  await page.goto("/search?mode=ai&q=Мусака");
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
  await expect(page.getByRole("main").getByRole("alert")).not.toContainText("Internal provider");
  await expect(page.getByRole("button", { name: "Опитай отново" })).toHaveCount(0);
  await page.clock.install(); await page.clock.runFor(60001);
  expect(calls).toBe(1);
});

test("environment files are not publicly accessible", async ({ request }) => {
  for (const path of ["/.env.local", "/.env", "/.env.example"]) {
    const response = await request.get(path);
    expect([403, 404]).toContain(response.status());
    const body = await response.text();
    // Boolean assertion avoids printing a secret-bearing body if this ever regresses.
    expect(body.includes("OPENAI_API_KEY=")).toBe(false);
  }
});
