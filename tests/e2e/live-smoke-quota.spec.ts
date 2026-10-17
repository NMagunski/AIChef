import { test, expect } from "./fixtures";
import { errorMessages, mapGenerationError } from "../../src/lib/ai/errors";
import recording from "../fixtures/live-smoke-quota.json";

const corrected = mapGenerationError({ status: recording.httpStatus, code: recording.providerCode, type: recording.providerType });

// Recorded failure from the one authorized live attempt. All traffic is mocked.
for (const width of [1440, 375]) {
  test(`recorded live quota failure is controlled and never auto-retried at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    let calls = 0;
    await page.route("**/api/recipes/generate", async (route) => {
      calls++;
      expect(route.request().postDataJSON()).toEqual({ query: "Рецепта за традиционна българска мусака за 4 порции" });
      await route.fulfill({ status: corrected.status, json: { error: { code: corrected.code, message: errorMessages[corrected.code], retryable: corrected.retryable } } });
    });
    await page.goto(`/search?mode=ai&q=${encodeURIComponent("Рецепта за традиционна българска мусака за 4 порции")}`);
    await expect(page.getByRole("heading", { name: "Не успяхме да създадем рецепта" })).toBeVisible();
    await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
    await expect(page.getByRole("button", { name: "Опитай отново" })).toHaveCount(0);
    await expect(page.getByRole("main").getByRole("alert")).toContainText("кредит");
    await expect(page.getByRole("main").getByRole("alert")).not.toContainText("минута");
    await expect(page.getByRole("article")).toHaveCount(0);
    await expect(page.getByRole("main")).not.toContainText("credit_balance_exhausted");
    await expect(page.getByRole("main")).not.toContainText("insufficient_quota");
    await page.clock.install();
    await page.clock.runFor(60001);
    expect(calls).toBe(1);
    expect(await page.evaluate(() => sessionStorage.getItem("aichef:generated:v1"))).toBeNull();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
