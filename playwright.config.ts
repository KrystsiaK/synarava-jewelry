import { defineConfig, devices } from "@playwright/test";

import { ADMIN_STORAGE_STATE_PATH } from "./e2e/support/auth";

// Admin CRUD specs (e2e/admin-products.spec.ts, admin-collections.spec.ts,
// ...) run pre-authenticated via the "chromium-admin" project below.
// admin-auth.spec.ts is deliberately excluded: it tests the login/logout
// mechanics themselves and must start from a clean, unauthenticated context.
const ADMIN_CRUD_SPEC_PATTERN = /e2e\/admin-(?!auth\.spec\.ts).*\.spec\.ts$/;

// Bind and probe 127.0.0.1 explicitly. Playwright treats HTTP status >= 404 as
// "not ready"; probing `/` can hang on SSR or return 404 before proxy redirect.
// Port-only readiness only checks that next is listening.
const E2E_HOST = "127.0.0.1";
const E2E_PORT = 3000;
const E2E_ORIGIN = `http://${E2E_HOST}:${E2E_PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: E2E_ORIGIN,
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
    {
      name: "mobile-webkit-smoke",
      use: { ...devices["iPhone 13"] },
      testMatch: /e2e\/smoke\.spec\.ts$/,
    },
  ],
  webServer: {
    // CI: production server after an explicit `pnpm build` step (see ci.yml).
    // Local: `next dev` with reuse so an already-running app is fine.
    command: process.env.CI
      ? `pnpm exec next start --hostname ${E2E_HOST} --port ${E2E_PORT}`
      : "pnpm dev",
    port: E2E_PORT,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
