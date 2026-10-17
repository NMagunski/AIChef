import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import { variantRecipe } from "../helpers/hybrid-recipe";
import { modelRecipe } from "../helpers/ai-recipe";
import { generatedRecipeId, normalizeRecipe } from "../../src/lib/ai/recipe-schema";
import { webResult } from "../helpers/web-recipe";
import type { ResolvedRecipe } from "../../src/types/recipe";
const region = (page: Page) => page.getByRole("region", { name: "Подбрани пълни рецепти" });
function uncheckedRecipe(change: (r: ResolvedRecipe) => void, alternative = false) {
  const r = normalizeRecipe(modelRecipe(), "mock-model");
  r.source = { kind: "ai", mode: "live", model: "mock-model", discoveryType: alternative ? "ai_alternative" : "ai_original" };
  change(r); r.id = generatedRecipeId({ ...r, id: "" }); return r;
}
const unsafe = (alternative = false) => uncheckedRecipe((r) => { r.title = "Невалидна рецепта"; r.preparation!.steps[1].description = "Сервирай сурово пилешко месо."; }, alternative);
async function mock(page: Page, recipe: ResolvedRecipe | undefined = variantRecipe(), alternatives: ResolvedRecipe[] = [variantRecipe(1)], web = false) {
  await page.route("**/api/recipes/generate", (route) => route.fulfill({ json: { ...(recipe ? { recipe } : {}), alternatives, issues: [], maxExtraBatches: 0 } }));
  await page.route("**/api/recipes/search-web", (route) => route.fulfill({ json: { results: web ? [webResult()] : [], nextCursor: null, limitations: [] } }));
}
async function fromHome(page: Page, query = "Пиле с ориз") { await page.goto("/"); await page.getByRole("searchbox").fill(query); await page.getByRole("searchbox").press("Enter"); await page.getByRole("navigation", { name: "Режим на търсене" }).getByRole("link", { name: "AI рецепта", exact: true }).click(); }
async function completeJourney(page: Page, recipe: ResolvedRecipe, mobile: boolean) {
  await region(page).getByRole("heading", { name: recipe.title, exact: true }).getByRole("link").click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(recipe.title);
  const rice = page.getByRole("checkbox", { name: /ориз/iu });
  await page.getByRole("button", { name: "Увеличи порциите" }).click(); await expect(rice.locator("..")).toContainText("375 г"); await rice.check();
  await page.reload(); await expect(rice).toBeChecked();
  await page.getByRole("link", { name: "Започни да готвиш" }).click();
  if (mobile) await page.getByRole("button", { name: "Продукти", exact: true }).click();
  await expect(rice).toBeChecked();
  await page.getByRole("button", { name: /следваща/u }).click(); await page.getByRole("button", { name: "Старт на таймера" }).click();
  await page.reload(); await expect(page.getByRole("button", { name: "Пауза на таймера" })).toBeEnabled();
  await page.getByRole("link", { name: "Изход" }).click(); await expect(page).toHaveURL(new RegExp(`/recipes/${recipe.id}$`)); await expect(page.getByRole("heading", { level: 1 })).toHaveText(recipe.title); await expect(rice).toBeChecked();
  await page.goBack(); await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Готвим: ${recipe.title}`);
  await page.goForward(); await expect(page.getByRole("heading", { level: 1 })).toHaveText(recipe.title);
  await page.getByRole("link", { name: "Започни да готвиш" }).click(); await page.getByRole("button", { name: "Завърши готвенето" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Браво! Ястието е готово!");
}
for (const width of [1440, 375]) {
  test(`quality full original AI journey with persistence, timer and history ${width}px`, async ({ page }) => { await page.setViewportSize({ width, height: 900 }); await mock(page); await fromHome(page); await expect(region(page).getByRole("article")).toHaveCount(2); await completeJourney(page, variantRecipe(), width === 375); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); });
  test(`quality authorized web full journey ${width}px`, async ({ page }) => { await page.setViewportSize({ width, height: 900 }); await mock(page, variantRecipe(), [], true); await fromHome(page); await expect(region(page).getByRole("article")).toHaveCount(2); await completeJourney(page, webResult().recipe!, width === 375); });
}
test("quality invalid original rejected while valid alternative stays usable from home", async ({ page }) => { await mock(page, unsafe()); await fromHome(page); await expect(region(page).getByRole("article")).toHaveCount(1); await expect(page.getByText("Рецепта не премина проверките за данни и ограничения и не е показана.")).toBeVisible(); await expect(region(page)).not.toContainText("Невалидна рецепта"); await region(page).getByRole("heading", { name: variantRecipe(1).title }).getByRole("link").click(); await expect(page.getByRole("link", { name: "Започни да готвиш" })).toBeVisible(); });
test("quality invalid AI alternative excluded and valid siblings retained", async ({ page }) => { await mock(page, variantRecipe(), [unsafe(true), variantRecipe(2)]); await page.goto("/search?mode=ai&q=Пиле"); await expect(region(page).getByRole("article")).toHaveCount(2); await expect(region(page)).not.toContainText("Невалидна рецепта"); });
test("quality explicit peanut exclusions preserve only compliant complete recipes", async ({ page }) => { const bad = uncheckedRecipe((r) => { r.title = "С фъстъци"; r.preparation!.ingredients[1].name = "Фъстъчено масло"; }, true); await mock(page, variantRecipe(), [bad, variantRecipe(2)]); await fromHome(page, "Пиле без фъстъци"); await expect(region(page).getByRole("article")).toHaveCount(2); await expect(region(page)).not.toContainText("С фъстъци"); await region(page).getByRole("heading", { name: variantRecipe(2).title }).getByRole("link").click(); await expect(page.getByRole("checkbox", { name: /Фъстъчено/iu })).toHaveCount(0); });
test("quality warnings accessible by keyboard without numeric ratings or certification", async ({ page }) => { const warning = uncheckedRecipe((r) => { r.preparation!.ingredients[1].quantity = 8000; }); await mock(page, warning, []); await page.goto("/search?mode=ai&q=Пиле"); const details = region(page).locator("details"); await expect(details).toHaveCount(1); const summary = details.locator("summary"); await summary.focus(); await page.keyboard.press("Enter"); await expect(details).toHaveAttribute("open", ""); await expect(details).toContainText("необичайно голямо"); await expect(details).toContainText("не гарантират безопасност"); await expect(region(page)).not.toContainText(/\d+\s*\/\s*100|сертифицирана|гарантирано безопасна|рейтинг/iu); await region(page).getByRole("heading", { name: warning.title }).getByRole("link").click(); await expect(page.locator("summary").filter({ hasText: "Бележки за данните" })).toBeVisible(); });
test("quality all invalid results show localized error without internal codes", async ({ page }) => { await mock(page, unsafe(), []); await page.goto("/search?mode=ai&q=Пиле"); const alert = page.getByRole("region", { name: "AI рецепта" }).getByRole("alert"); await expect(alert).toContainText("Получената рецепта не премина проверките"); await expect(page.getByRole("main")).not.toContainText(/UNSAFE_RAW_POULTRY|INVALID_OUTPUT|stack|Сервирай сурово/u); await expect(region(page).getByRole("article")).toHaveCount(0); });
test("quality invalid licensed web recipe becomes metadata without blocking valid AI", async ({ page }) => { await mock(page, variantRecipe(), []); const invalid = webResult(); invalid.recipe!.preparation!.ingredients[0].name = "Пилешко месо"; invalid.recipe!.preparation!.steps[0].description = "Сервирай сурово пилешко месо."; await page.route("**/api/recipes/search-web", (route) => route.fulfill({ json: { results: [invalid], nextCursor: null, limitations: [] } })); await page.goto("/search?mode=ai&q=Пиле"); await expect(region(page).getByRole("article")).toHaveCount(1); await expect(page.getByRole("region", { name: "Още интернет рецепти" }).getByRole("link", { name: "Отвори оригинала", exact: true })).toBeVisible(); await expect(page.getByRole("main")).not.toContainText("Сервирай сурово"); });
test("quality refresh keeps warnings and rejects unsafe legacy session records", async ({ page }) => { const warning = uncheckedRecipe((r) => { r.preparation!.ingredients[1].quantity = 8000; }); await mock(page, warning, []); await page.goto("/search?mode=ai&q=Пиле"); await expect(page.locator("summary").filter({ hasText: "Бележки за данните" })).toBeVisible(); await page.reload(); await expect(page.locator("summary").filter({ hasText: "Бележки за данните" })).toBeVisible(); const bad = unsafe(); await page.evaluate((recipe) => sessionStorage.setItem("aichef:generated:v1", JSON.stringify([{ recipe, queryKey: "legacy", expiresAt: Date.now() + 60000 }])), bad); await page.goto(`/recipes/${bad.id}`); await expect(page.getByRole("link", { name: "Започни да готвиш" })).toHaveCount(0); });
test("quality mobile warning presentation has no horizontal overflow", async ({ page }) => { await page.setViewportSize({ width: 375, height: 812 }); const warning = uncheckedRecipe((r) => { r.preparation!.ingredients[1].quantity = 8000; }); await mock(page, warning, []); await page.goto("/search?mode=ai&q=Пиле"); const summary = page.locator("summary").filter({ hasText: "Бележки за данните" }); await summary.click(); await expect(page.getByText(/необичайно голямо/u)).toBeVisible(); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); });
