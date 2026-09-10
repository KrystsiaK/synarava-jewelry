import { adminCredentials, hasAdminCredentials } from "./support/auth";
import { expect, test } from "./support/fixtures";

// Runs in the "chromium-admin" project (see playwright.config.ts), which
// starts every test already authenticated via the storage state produced by
// support/auth.setup.ts.
//
// Read-only smoke coverage for the admin routes that don't fit the
// products/collections/pages CRUD pattern:
// - Account is a static session summary, nothing to mutate.
// - Issues can trigger a real Resend email via "Scan now" when
//   RESEND_API_KEY is configured, so this only checks the page renders --
//   it never clicks the scan button.
// Videos is deliberately not covered here: uploading exercises a real S3
// bucket (Railway Bucket) outside this sandbox.
test.describe("Admin misc pages", () => {
  test.beforeEach(() => {
    test.skip(!hasAdminCredentials(), "Local admin credentials are not configured.");
  });

  test("account page shows the active admin session", async ({ page }) => {
    await page.goto("/admin/account");

    await expect(page.getByRole("heading", { name: "Account" })).toBeVisible();
    await expect(page.getByText(adminCredentials()!.username)).toBeVisible();
  });

  test("issues page renders the problems table", async ({ page }) => {
    await page.goto("/admin/issues");

    await expect(page.getByRole("heading", { name: "Problems", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Problems table" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Scan now" })).toBeVisible();
  });
});
