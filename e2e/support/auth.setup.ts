import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { test as setup } from "@playwright/test";

import { ADMIN_STORAGE_STATE_PATH, hasAdminCredentials, loginAsAdmin } from "./auth";

setup("authenticate as admin", async ({ page }) => {
  if (!hasAdminCredentials()) {
    // Write an empty-but-valid storage state so the "chromium-admin" project
    // (which always points at this path) can still create a browser context
    // instead of failing on a missing file. Specs that actually need a
    // session are responsible for `test.skip(!hasAdminCredentials(), ...)`;
    // they'll see a logged-out redirect here rather than a config crash.
    mkdirSync(dirname(ADMIN_STORAGE_STATE_PATH), { recursive: true });
    writeFileSync(ADMIN_STORAGE_STATE_PATH, JSON.stringify({ cookies: [], origins: [] }));
    setup.skip(true, "Local admin credentials are not configured.");
    return;
  }

  await loginAsAdmin(page);
  await page.context().storageState({ path: ADMIN_STORAGE_STATE_PATH });
});
