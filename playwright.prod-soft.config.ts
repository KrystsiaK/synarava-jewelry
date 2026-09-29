import { defineConfig, devices } from "@playwright/test";

/**
 * Soft axe runs against the live storefront (no local webServer).
 * Default origin: https://shop.synarava.com — override with STOREFRONT_URL.
 */
const STOREFRONT =
  process.env.STOREFRONT_URL?.replace(/\/$/, "") || "https://shop.synarava.com";

export default defineConfig({
  testDir: "./e2e",
  testMatch: /a11y-prod-soft\.spec\.ts$/,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report-prod-soft" }],
  ],
  use: {
    baseURL: STOREFRONT,
    trace: "off",
  },
  projects: [
    {
      name: "chromium-prod-soft",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
