import { defineConfig, devices } from "@playwright/test";

import { ADMIN_STORAGE_STATE_PATH } from "./e2e/support/auth";

// Admin CRUD specs (e2e/admin-products.spec.ts, admin-collections.spec.ts,
// ...) run pre-authenticated via the "chromium-admin" project below.
// admin-auth.spec.ts is deliberately excluded: it tests the login/logout
// mechanics themselves and must start from a clean, unauthenticated context.
const ADMIN_CRUD_SPEC_PATTERN = /e2e\/admin-(?!auth\.spec\.ts).*\.spec\.ts$/;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "setup",
      testMatch: /.*\.setup\.ts$/,
    },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: ADMIN_CRUD_SPEC_PATTERN,
    },
    {
      name: "chromium-admin",
      use: { ...devices["Desktop Chrome"], storageState: ADMIN_STORAGE_STATE_PATH },
      testMatch: ADMIN_CRUD_SPEC_PATTERN,
      dependencies: ["setup"],
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
