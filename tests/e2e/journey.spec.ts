import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";

const details = "/recipes/pile-s-oriz";
const cook = `${details}/cook`;
const storageKey = "aichef:cooking:v1:pile-s-oriz";
const next = (page: Page) => page.getByRole("button", { name: /следваща/ });
const rice = (page: Page) => page.getByRole("checkbox", { name: /Ориз/ });

test("home → search URL → matching card → correct details; back restores query", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Какво ще готвим днес");
  await page.getByRole("searchbox").fill("пиле с ориз");
  await page.getByRole("button", { name: "Търси", exact: true }).click();
  await expect(page).toHaveURL(/\/search\?q=/);
  expect(new URL(page.url()).searchParams.get("q")).toBe("пиле с ориз");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("пиле с ориз");
  await page.getByRole("heading", { name: "Пиле с ориз (класическа рецепта)", exact: true }).getByRole("link").click();
  await expect(page).toHaveURL(new RegExp(`${details}$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Пиле с ориз (класическа рецепта)");
  await page.goBack();
  await expect(page.getByRole("searchbox")).toHaveValue("пиле с ориз");
  await page.goForward();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Пиле с ориз (класическа рецепта)");
});

test("servings and checklist persist across details, cook, refresh and back; recipes isolated", async ({ page }) => {
  await page.goto(details);
  await page.getByRole("button", { name: "Увеличи порциите" }).click({ clickCount: 2 });
  await expect(page.getByRole("group", { name: "Брой порции" })).toContainText("6 порции");
  await rice(page).check();
  await expect(rice(page)).toBeChecked();
  await page.reload();
  await expect(page.getByRole("group", { name: "Брой порции" })).toContainText("6 порции");
  await expect(rice(page)).toBeChecked();
  await page.getByRole("link", { name: "Започни да готвиш" }).click();
  await expect(page).toHaveURL(new RegExp(`${cook}$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Готвим: Пиле с ориз (класическа рецепта)");
  await expect(page.locator("[data-cooking] > header")).toContainText("6 порции");
  await expect(rice(page)).toBeChecked();
  await expect(rice(page).locator("..")).toContainText("450 г");
  await rice(page).uncheck();
  await page.getByRole("link", { name: "Към рецептата", exact: true }).click();
  await expect(rice(page)).not.toBeChecked();
  await expect(page.getByRole("group", { name: "Брой порции" })).toContainText("6 порции");
  await page.goto("/recipes/musaka");
  await expect(page.getByRole("group", { name: "Брой порции" })).toContainText("6 порции");
  await expect(page.getByRole("checkbox").first()).not.toBeChecked();
  await page.getByRole("button", { name: "Увеличи порциите" }).click();
  await expect(page.getByRole("group", { name: "Брой порции" })).toContainText("7 порции");
  await page.goto(details);
  await expect(page.getByRole("group", { name: "Брой порции" })).toContainText("6 порции");
});

test("cooking progress/timer survives refresh and exit; completion and explicit restart", async ({ page }) => {
  await page.goto(cook);
  await next(page).click();
  await page.getByRole("button", { name: "Старт на таймера" }).click();
  await page.reload();
  await expect(page.locator("#current-step-title")).toHaveText("Запържи зеленчуците");
  await expect(page.getByRole("button", { name: "Пауза на таймера" })).toBeEnabled();
  await page.getByRole("link", { name: "Към рецептата", exact: true }).click();
  await page.getByRole("link", { name: "Започни да готвиш" }).click();
  await expect(page.locator("#current-step-title")).toHaveText("Запържи зеленчуците");
  for (let step = 2; step < 7; step++) await next(page).click();
  await page.getByRole("button", { name: "Завърши готвенето" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Браво! Ястието е готово!");
  await expect(page.getByRole("heading", { level: 2 })).toHaveText("Пиле с ориз (класическа рецепта)");
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Браво! Ястието е готово!");
  await page.getByRole("button", { name: "Приготви отново" }).click();
  await expect(page.locator("[data-cooking] > header")).toContainText("Стъпка 1 от 7 · 0 завършени");
});

test("invalid recipe IDs return 404; empty query and no results stay usable", async ({ page }) => {
  for (const path of ["/recipes/not-a-recipe", "/recipes/not-a-recipe/cook"]) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }
  await page.goto("/search?q=несъществуващопримерноястие");
  await expect(page.getByRole("heading", { name: "Все още нямаме рецепта за това търсене." })).toBeVisible();
  await page.getByRole("link", { name: "Виж всички демо рецепти" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Открий рецепти");
  await expect(page.getByRole("heading", { name: "Пиле с ориз (класическа рецепта)", exact: true })).toBeVisible();
});

test("corrupt storage and unavailable storage degrade gracefully", async ({ page }) => {
  await page.goto("/");
  await page.evaluate((key) => localStorage.setItem(key, "{broken-json"), storageKey);
  await page.goto(cook);
  await expect(page.getByText("Не успяхме да прочетем запазения прогрес. Започваме нова сесия.")).toBeVisible();
  await next(page).click();
  await expect(page.locator("[data-cooking] > header")).toContainText("Стъпка 2 от 7");
  await page.addInitScript(() => Object.defineProperty(window, "localStorage", { get() { throw new Error("Storage blocked"); } }));
  await page.reload();
  await expect(page.getByText(/Локалното запазване е недостъпно/)).toBeVisible();
  await next(page).click();
  await expect(page.locator("[data-cooking] > header")).toContainText("Стъпка 2 от 7");
});

for (const width of [375, 390, 768, 1440, 1920]) {
  test(`four routes are usable without overflow at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    for (const [name, path] of [["home", "/"], ["search", "/search?q=пилешко"], ["details", details], ["cooking", cook]]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      if (name === "cooking") await expect(next(page)).toBeEnabled();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      if (name !== "home") await expect(page.getByRole("navigation", { name: width <= 700 ? "Мобилна навигация" : "Основна навигация" }).locator('a[aria-current="page"]')).toContainText(width <= 700 ? "Търсене" : "Открий рецепти");
      if (name === "cooking" && width === 1440) {
        const bounds = await next(page).boundingBox();
        expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(900);
      }
      await page.screenshot({ path: testInfo.outputPath(`${name}-${width}.png`), fullPage: true });
    }
  });
}
