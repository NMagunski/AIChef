import { test, expect } from "./fixtures";
import recorded from "../fixtures/live-web-search.json";
import { aiRecipe } from "../helpers/ai-recipe";

// Replay only. These mocks never contact SerpApi or any discovered publisher.
for (const width of [1440, 375]) for (const entry of recorded.queries) test(`recorded live discovery: ${entry.query} at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  let aiCalls = 0, webCalls = 0;
  await page.route("**/api/recipes/generate", (route) => { aiCalls++; return route.fulfill({ json: { recipe: aiRecipe() } }); });
  await page.route("**/api/recipes/search-web", (route) => {
    const body = route.request().postDataJSON();
    expect(body.query).toBe(entry.query);
    const pageIndex = body.cursor === null ? 0 : entry.pages.findIndex((_p, index) => index > 0 && entry.pages[index - 1].nextCursor === body.cursor);
    expect(pageIndex).toBeGreaterThanOrEqual(0); webCalls++;
    return route.fulfill({ json: entry.pages[pageIndex] });
  });
  await page.goto(`/search?mode=ai&q=${encodeURIComponent(entry.query)}`);
  await expect(page.getByRole("article")).toHaveCount(3);
  await expect(page.getByRole("region", { name: "AI рецепта" }).getByText("AI рецепта", { exact: true })).toBeVisible();
  const more = page.getByRole("button", { name: "Покажи още рецепти" });
  let shown = entry.pages[0].results.length;
  for (const next of entry.pages.slice(1)) { await more.click(); shown += next.results.length; await expect(page.getByRole("article")).toHaveCount(shown + 1); }
  await expect(more).toBeDisabled();
  const metadata = page.getByRole("article").filter({ hasText: "От интернет" });
  const results = entry.pages.flatMap((p) => p.results);
  await expect(metadata).toHaveCount(results.length);
  for (const result of results) {
    // Different publishers can legitimately share the title "Мусака". Identify
    // the card by its canonical original URL, rather than asserting unique titles.
    const original = page.getByRole("link", { name: "Отвори оригинала", exact: true }).and(page.locator(`[href="${result.url}"]`));
    const card = metadata.filter({ has: original });
    await expect(card).toHaveCount(1);
    await expect(card.getByRole("heading", { name: result.title, exact: true })).toBeVisible();
    await expect(card).toContainText(`Източник: ${result.sourceName}`);
    await expect(card.getByRole("link", { name: "Отвори оригинала", exact: true })).toHaveAttribute("href", result.url);
    await expect(card.getByRole("link", { name: "Отвори оригинала", exact: true })).toHaveAttribute("rel", "noopener noreferrer");
    await expect(card.getByRole("link", { name: /Виж рецептата/u })).toHaveCount(0);
  }
  expect(new Set(results.map((r) => r.id)).size).toBe(results.length);
  expect(await page.locator("img").evaluateAll((images) => images.every((image) => !/^https?:/i.test(image.getAttribute("src") ?? "")))).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(webCalls).toBe(entry.pages.length); expect(aiCalls).toBe(1);
});
