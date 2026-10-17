import { test, expect } from "./fixtures";

for (const width of [375, 1440]) {
  test(`keyboard search, empty-state recovery and recipe controls at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const search = page.getByRole("searchbox", { name: "Търси рецепта, продукт или идея" });
    await search.focus();
    await expect(search).toBeFocused();
    expect(await search.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe("none");
    await search.fill("несъществуващопримерноястие");
    await search.press("Enter");
    await expect(page.getByRole("heading", { name: "Все още нямаме рецепта за това търсене." })).toBeVisible();
    const allRecipes = page.getByRole("link", { name: "Виж всички демо рецепти" });
    await allRecipes.focus();
    await allRecipes.press("Enter");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Открий рецепти");
    const recipe = page.getByRole("heading", { name: "Пиле с ориз (класическа рецепта)", exact: true }).getByRole("link");
    await recipe.focus();
    await recipe.press("Enter");
    const increase = page.getByRole("button", { name: "Увеличи порциите" });
    await increase.focus();
    await increase.press("Enter");
    await expect(page.getByRole("group", { name: "Брой порции" })).toContainText("5 порции");
    const rice = page.getByRole("checkbox", { name: /Ориз/ });
    await rice.focus();
    await rice.press("Space");
    await expect(rice).toBeChecked();
    await page.reload();
    await expect(rice).toBeChecked();
    await expect(page.getByRole("group", { name: "Брой порции" })).toContainText("5 порции");
  });
}
