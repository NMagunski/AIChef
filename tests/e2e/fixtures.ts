import { test as base, expect } from "@playwright/test";

/** Shared isolation for every browser suite. Register deterministic API mocks
 * in the test with page.route(..., route => route.fulfill(...)); those routes
 * take precedence over this default guard. No real provider traffic is allowed. */
export const test = base.extend({
  page: async ({ page, baseURL }, runTest) => {
    if (!baseURL) throw new Error("E2E tests require the local production baseURL.");
    const origin = new URL(baseURL).origin;
    const unexpectedRequests: string[] = [];
    const runtimeErrors: string[] = [];
    page.on("pageerror", (error) => runtimeErrors.push(error.message));
    await page.route("**/*", (route) => {
      const url = route.request().url();
      if (new URL(url).origin === origin) return route.continue();
      unexpectedRequests.push(url);
      return route.abort();
    });
    await page.route("**/api/recipes/search-web", (route) => route.fulfill({ json: { results: [], nextCursor: null, limitations: [] } }));
    await runTest(page);
    expect(unexpectedRequests, "External requests must have explicit deterministic mocks").toEqual([]);
    expect(runtimeErrors, "The application must not raise browser runtime errors").toEqual([]);
  },
});

export { expect };
