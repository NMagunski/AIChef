import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import { hybridBundle, variantRecipe } from "../helpers/hybrid-recipe";
import { webResult } from "../helpers/web-recipe";
import { normalizeVariant } from "../../src/lib/ai/hybrid";
import { variantModel } from "../helpers/hybrid-recipe";
const initial = (page: Page) => page.getByRole("region", { name: "Подбрани пълни рецепти" });
async function mockSearch(page: Page, licensed = 0, bundle = hybridBundle(3 - licensed)) {
  await page.route("**/api/recipes/generate", (route) => route.fulfill({ json: bundle }));
  await page.route("**/api/recipes/search-web", (route) => route.fulfill({ json: { results: Array.from({ length: 2 }, (_, i) => webResult(i + 1, i < licensed)), nextCursor: null, limitations: [] } }));
}
for (const licensed of [2, 1, 0]) test(`hybrid initial selection: ${licensed} licensed, ${2 - licensed} alternatives`, async ({ page }) => {
  await mockSearch(page, licensed);
  await page.goto("/search?mode=ai&q=Пиле");
  await expect(initial(page).getByRole("article")).toHaveCount(3);
  await expect(initial(page).getByText("AI рецепта", { exact: true })).toHaveCount(1);
  await expect(initial(page).getByText("AI алтернатива", { exact: true })).toHaveCount(2 - licensed);
  await expect(initial(page).getByText("От интернет", { exact: true })).toHaveCount(licensed);
  const metadata = page.getByRole("region", { name: "Още интернет рецепти" });
  await expect(metadata.getByRole("heading", { name: "Още рецепти в интернет" })).toBeVisible();
  await expect(metadata.getByRole("article")).toHaveCount(2 - licensed);
  if (licensed) {
    await initial(page).getByRole("heading", { name: webResult(1).title, exact: true }).getByRole("link").click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(webResult(1).title);
    await expect(page.getByRole("link", { name: "Започни да готвиш" })).toBeVisible();
  } else {
    const badge = initial(page).getByText("AI алтернатива", { exact: true }).first();
    expect(await badge.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(113, 82, 147)");
  }
});
for (const width of [1440, 375]) test(`hybrid alternative full journey with portions, checks, timer and history at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 900 });
  await mockSearch(page); const recipe = variantRecipe(1);
  await page.goto("/"); await page.getByRole("searchbox").fill("Пиле с ориз"); await page.getByRole("searchbox").press("Enter");
  // Test server defaults to demo: explicitly choose the real discovery UI, with mocked APIs.
  await page.getByRole("navigation", { name: "Режим на търсене" }).getByRole("link", { name: "AI рецепта", exact: true }).click();
  await expect(initial(page).getByRole("article")).toHaveCount(3);
  await page.screenshot({ path: testInfo.outputPath(`hybrid-${width}.png`), fullPage: true });
  await initial(page).getByRole("heading", { name: recipe.title, exact: true }).getByRole("link").click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(recipe.title);
  await expect(page.getByText("AI алтернатива", { exact: true }).first()).toBeVisible();
  const rice = page.getByRole("checkbox", { name: /Ориз/u });
  await expect(rice.locator("..")).toContainText("300 г");
  await page.getByRole("button", { name: "Увеличи порциите" }).click(); await expect(rice.locator("..")).toContainText("375 г"); await rice.check();
  await page.reload(); await expect(rice).toBeChecked();
  await page.getByRole("link", { name: "Започни да готвиш" }).click(); await expect(page).toHaveURL(new RegExp(`/recipes/${recipe.id}/cook$`));
  if (width === 375) await page.getByRole("button", { name: "Продукти", exact: true }).click();
  await expect(rice).toBeChecked(); await expect(rice.locator("..")).toContainText("375 г");
  await page.getByRole("button", { name: /следваща/u }).click(); await page.getByRole("button", { name: "Старт на таймера" }).click();
  await page.reload(); await expect(page.getByRole("button", { name: "Пауза на таймера" })).toBeEnabled();
  await page.getByRole("link", { name: "Изход" }).click(); await expect(page).toHaveURL(new RegExp(`/recipes/${recipe.id}$`)); await expect(rice).toBeChecked();
  await page.goBack(); await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Готвим: ${recipe.title}`);
  await page.goForward(); await expect(page.getByRole("heading", { level: 1 })).toHaveText(recipe.title);
  await page.getByRole("link", { name: "Започни да готвиш" }).click(); await page.getByRole("button", { name: "Завърши готвенето" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Браво! Ястието е готово!");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test("metadata-only journey starts at home and opens the original without internal instructions", async ({ page, context }) => {
  await mockSearch(page); const metadata = webResult(1, false);
  await context.route(metadata.url, (route) => route.fulfill({ contentType: "text/html", body: "<h1>Original source fixture</h1>" }));
  await page.goto("/"); await page.getByRole("searchbox").fill("Пиле"); await page.getByRole("searchbox").press("Enter");
  await page.getByRole("navigation", { name: "Режим на търсене" }).getByRole("link", { name: "AI рецепта", exact: true }).click();
  const card = page.getByRole("region", { name: "Още интернет рецепти" }).getByRole("article").filter({ has: page.getByRole("heading", { name: metadata.title, exact: true }) });
  await expect(card).not.toContainText("Измери тестовите продукти"); await expect(card.getByRole("link", { name: /Виж рецептата/u })).toHaveCount(0);
  const popupEvent = page.waitForEvent("popup"); await card.getByRole("link", { name: "Отвори оригинала", exact: true }).click(); const popup = await popupEvent; await expect(popup).toHaveURL(metadata.url); await popup.close();
});
test("Show More prioritizes web pages, preserves filters, deduplicates and caps extra AI", async ({ page }) => {
  let aiCalls = 0, webCalls = 0;
  let release!: () => void; const webGate = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/recipes/generate", (route) => { aiCalls++; const body = route.request().postDataJSON(); return route.fulfill({ json: body.batch ? { alternatives: [variantRecipe(3), variantRecipe(4)], issues: [], maxExtraBatches: 1 } : hybridBundle() }); });
  await page.route("**/api/recipes/search-web", async (route) => { webCalls++; const body = route.request().postDataJSON(); if (!body.cursor) await webGate; return route.fulfill({ json: { results: body.cursor ? [webResult(1, false), webResult(3)] : [webResult(1, false), webResult(2, false)], nextCursor: body.cursor ? null : "10:0", limitations: [] } }); });
  await page.goto("/search?mode=ai&q=Пиле"); await expect(initial(page).getByRole("article")).toHaveCount(3);
  const more = page.getByRole("button", { name: "Покажи още рецепти" }); await expect(more).toBeDisabled(); release(); await expect(more).toBeEnabled();
  await page.getByRole("button", { name: "До 30 мин", exact: true }).click();
  await more.click();
  await expect(initial(page).getByText("От интернет", { exact: true })).toHaveCount(1); expect(aiCalls).toBe(1); expect(webCalls).toBe(2);
  await more.click(); await expect(more).toBeDisabled(); expect(aiCalls).toBe(2);
  await expect(page.getByRole("button", { name: "До 30 мин", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("region", { name: "Още пълни рецепти" }).getByRole("article")).toHaveCount(3);
  await expect(page.getByText("Достигнат е лимитът за допълнителни AI варианти.")).toBeVisible();
});
test("refresh/back/filter changes reuse the validated bundle without regeneration", async ({ page }) => {
  let calls = 0; await mockSearch(page);
  await page.route("**/api/recipes/generate", (route) => { calls++; return route.fulfill({ json: hybridBundle() }); });
  await page.goto("/search?mode=ai&q=Пиле"); await expect(initial(page).getByRole("article")).toHaveCount(3);
  await page.getByRole("button", { name: "Над 60 мин", exact: true }).click(); await expect(page.getByText("Няма рецепти с тези филтри.")).toBeVisible();
  await page.getByRole("button", { name: "Всички", exact: true }).click(); await expect(initial(page).getByRole("article")).toHaveCount(3);
  await initial(page).getByRole("heading", { name: variantRecipe(1).title, exact: true }).getByRole("link").click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(variantRecipe(1).title); await page.goBack();
  await expect(initial(page).getByRole("article")).toHaveCount(3); await page.reload(); await expect(initial(page).getByRole("article")).toHaveCount(3); expect(calls).toBe(1);
});
for (const scenario of ["AI down", "Web down", "Both down"]) test(`hybrid partial failure: ${scenario}`, async ({ page }) => {
  await page.route("**/api/recipes/generate", (route) => route.fulfill(scenario !== "Web down" ? { status: 503, json: { error: { code: "INSUFFICIENT_QUOTA", retryable: false } } } : { json: hybridBundle() }));
  await page.route("**/api/recipes/search-web", (route) => route.fulfill(scenario !== "AI down" ? { status: 503, json: { error: { code: "QUOTA", retryable: false } } } : { json: { results: [webResult(), webResult(2)], nextCursor: null, limitations: [] } }));
  await page.goto("/search?mode=ai&q=Пиле"); await expect(initial(page).getByRole("article")).toHaveCount(scenario === "Both down" ? 0 : scenario === "AI down" ? 2 : 3);
  if (scenario !== "Web down") await expect(page.getByRole("region", { name: "AI рецепта" }).getByRole("alert")).toBeVisible();
  if (scenario !== "AI down") await expect(page.getByRole("region", { name: "Интернет търсене" }).getByRole("alert")).toBeVisible();
});
for (const query of ["Пиле без гъби за 6 порции", "Веган вечеря до 30 минути"]) test(`hybrid constrained variants: ${query}`, async ({ page }) => {
  const recipes = [0, 1, 2].map((index) => { const raw = variantModel(index, query.includes("6") ? 6 : 4); if (query.startsWith("Веган")) raw.ingredients[0].name = "Боб"; return normalizeVariant(raw, query, "mock-model", index ? "ai_alternative" : "ai_original"); });
  await mockSearch(page, 0, { recipe: recipes[0], alternatives: recipes.slice(1), issues: [], maxExtraBatches: 0 });
  await page.goto(`/search?mode=ai&q=${encodeURIComponent(query)}`); await expect(initial(page).getByRole("article")).toHaveCount(3);
  await initial(page).getByRole("heading", { name: recipes[1].title, exact: true }).getByRole("link").click();
  await expect(page.getByRole("checkbox", { name: /Гъби/u })).toHaveCount(0);
  if (query.startsWith("Веган")) await expect(page.getByRole("checkbox", { name: /Боб/u })).toBeVisible();
  else await expect(page.getByRole("group", { name: "Брой порции" })).toContainText("6 порции");
});
test("duplicate and invalid alternatives never become fabricated complete cards", async ({ page }) => {
  const original = hybridBundle().recipe;
  await page.route("**/api/recipes/generate", (route) => route.fulfill({ json: { recipe: original, alternatives: [variantRecipe(1), variantRecipe(1)], issues: ["Пропуснат е прекалено сходен AI вариант."], maxExtraBatches: 0 } }));
  await page.goto("/search?mode=ai&q=Пиле"); await expect(initial(page).getByRole("article")).toHaveCount(2);
  await expect(page.getByText("Пропуснат е прекалено сходен AI вариант.")).toBeVisible();
});
test("invalid alternative provenance is rejected rather than attributed to a publisher", async ({ page }) => {
  const bundle = hybridBundle();
  await page.route("**/api/recipes/generate", (route) => route.fulfill({ json: { ...bundle, alternatives: [{ ...variantRecipe(1), source: { kind: "web", mode: "live", name: "Invented publisher", url: "https://example.org" } }] } }));
  await page.goto("/search?mode=ai&q=Пиле");
  await expect(page.getByRole("region", { name: "AI рецепта" }).getByRole("alert")).toContainText("не премина проверките");
  await expect(initial(page).getByRole("article")).toHaveCount(0);
  await expect(page.getByRole("main")).not.toContainText("Invented publisher");
});
test("late licensed results keep only three complete cards until Show More reveals cached alternatives", async ({ page }) => {
  let aiCalls = 0; await mockSearch(page, 2, hybridBundle(3, 0));
  await page.route("**/api/recipes/generate", (route) => { aiCalls++; return route.fulfill({ json: hybridBundle(3, 0) }); });
  await page.goto("/search?mode=ai&q=Пиле");
  await expect(initial(page).getByRole("article")).toHaveCount(3);
  await expect(page.getByRole("article")).toHaveCount(3);
  await page.getByRole("button", { name: "Покажи още рецепти" }).click();
  await expect(page.getByRole("region", { name: "Още пълни рецепти" }).getByRole("article")).toHaveCount(2);
  await expect(page.getByRole("article")).toHaveCount(5); expect(aiCalls).toBe(1);
});
