import { mockCIEnvironment } from "./scripts/ci-env.mjs";
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  workers: process.env.CI ? 1 : 2,
  globalTimeout: 10 * 60 * 1000,
  retries: 1,
  failOnFlakyTests: true,
  forbidOnly: true,
  reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL: "http://127.0.0.1:4320", browserName: "chromium", trace: "on-first-retry", serviceWorkers: "block", viewport: { width: 1440, height: 900 }, reducedMotion: "reduce", screenshot: "only-on-failure" },
  webServer: {
    env: mockCIEnvironment(),
    command: "npx next start --hostname 127.0.0.1 --port 4320",
    url: "http://127.0.0.1:4320",
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
