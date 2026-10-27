import { defineConfig, devices } from "@playwright/test";

import { ADMIN_STORAGE_STATE_PATH } from "./e2e/support/auth";

const E2E_HOST = "127.0.0.1";
const E2E_PORT = 3000;
const E2E_ORIGIN = `http://${E2E_HOST}:${E2E_PORT}`;
const MOCK_SKU_PORT = 4099;
const SKU_TOKEN = "e2e-sku-token-min8";

/**
 * Desktop Chromium + WebKit for SKU Family native select sticky regression.
 * Starts mock sku-api so Inventory Family options exist without a real service.
 *
 * Always uses `next dev` so the suite picks up the working tree (this agent/CI
 * image often has CI=1, which would otherwise `next start` a stale .next).
 */
export default defineConfig({
  testDir: "./e2e",
  testMatch: /sku-family-select\.spec\.ts$/,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: E2E_ORIGIN,
    // Native <select> keyboard/mouse need a real display; headless swallows ArrowDown.
    headless: false,
    trace: "on-first-retry",
  },
  projects: [
    { name: "setup", testMatch: /.*\.setup\.ts$/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: ADMIN_STORAGE_STATE_PATH },
      dependencies: ["setup"],
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"], storageState: ADMIN_STORAGE_STATE_PATH },
      dependencies: ["setup"],
    },
  ],
  webServer: [
    {
      command: `MOCK_SKU_API_PORT=${MOCK_SKU_PORT} SKU_API_TOKEN=${SKU_TOKEN} node e2e/support/mock-sku-api.mjs`,
      url: `http://127.0.0.1:${MOCK_SKU_PORT}/health`,
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: `pnpm exec next dev --hostname ${E2E_HOST} --port ${E2E_PORT}`,
      url: E2E_ORIGIN,
      reuseExistingServer: false,
      timeout: 180_000,
      env: {
        ...process.env,
        DATABASE_URL: process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL || "",
        SKU_API_URL: `http://127.0.0.1:${MOCK_SKU_PORT}`,
        SKU_API_TOKEN: SKU_TOKEN,
        SKU_API_WORKSPACE: "synarava-shop",
      },
    },
  ],
});
