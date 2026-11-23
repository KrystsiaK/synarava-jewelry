import { defineConfig, devices } from "@playwright/test";

/**
 * Fixture-only Playwright (no Next webServer, no DB, no auth).
 * Used for admin chrome geometry guards against static HTML fixtures.
 */
export default defineConfig({
  testDir: "./e2e",
  testMatch: /topbar-chrome-fixture\.spec\.ts$/,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    trace: "on-first-retry",
  },
});
