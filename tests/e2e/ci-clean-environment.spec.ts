import { test, expect } from "./fixtures";
import { hybridBundle } from "../helpers/hybrid-recipe";
for (const width of [1440, 375]) test(`CI clean environment keeps paid APIs unconfigured and mock recipe search usable at ${width}px`, async ({ page, request }) => {
  await page.setViewportSize({ width, height: 900 });
  const ai = await request.post("/api/recipes/generate", { data: { query: "Пиле" } });
  expect(ai.status()).toBe(503); expect((await ai.json()).error.code).toBe("CONFIGURATION");
  const web = await request.post("/api/recipes/search-web", { data: { query: "Пиле" } });
  expect(web.status()).toBe(503); expect((await web.json()).error.code).toBe("CONFIGURATION");
  await page.route("**/api/recipes/generate", (route) => route.fulfill({ json: hybridBundle() }));
  await page.goto("/search?mode=ai&q=Пиле");
  await expect(page.getByRole("region", { name: "Подбрани пълни рецепти" }).getByRole("article")).toHaveCount(3);
  await expect(page.getByRole("main")).not.toContainText(/sk-proj-|API_REDIS_REST_TOKEN|API_IDENTITY_SECRET/u);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
