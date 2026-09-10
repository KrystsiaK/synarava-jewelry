import { hasAdminCredentials } from "./support/auth";
import { createTestPage, testDataPrefix } from "./support/factories";
import { expect, test } from "./support/fixtures";

// Runs in the "chromium-admin" project (see playwright.config.ts), which
// starts every test already authenticated via the storage state produced by
// support/auth.setup.ts.
test.describe("Admin pages CRUD", () => {
  test.beforeEach(() => {
    test.skip(!hasAdminCredentials(), "Local admin credentials are not configured.");
  });

  test("creates a page from the create form and lands on its edit route", async ({ page, runId }) => {
    const slug = `${testDataPrefix(runId)}-page-create`;
    const title = `E2E Create Page ${runId}`;

    await page.goto("/admin/pages/new");
    await page.locator('input[name="title"]').fill(title);
    await page.locator('input[name="slug"]').fill(slug);
    // The draft-autosave (700ms debounce, see use-draft-autosave.ts) can still
    // have a flush in flight or queued right after the fields above are
    // filled. Submitting while one is pending races it: the create below can
    // land correctly and then get silently overwritten by a stale queued
    // autosave reading the just-reset (blank) form. Let the debounce fire and
    // its request(s) fully settle before submitting.
    await page.waitForTimeout(750);
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Create page" }).click();

    await page.waitForURL(`**/admin/pages/${slug}`);
    await expect(page.getByRole("heading", { name: title }).first()).toBeVisible();
  });

  test("publishes, drafts, archives, and deletes a page from the pages table", async ({ page, runId }) => {
    const testPage = await createTestPage(runId, { status: "DRAFT" });

    await page.goto("/admin/pages");
    const row = page
      .locator("div")
      .filter({ hasText: testPage.slug })
      .filter({ has: page.getByRole("button", { name: "Details" }) })
      .last();

    await row.getByRole("button", { name: "Publish" }).click();
    await page.getByRole("button", { name: "Publish page" }).click();
    await expect(row.locator(".adm-badge-published")).toHaveText("PUBLISHED");

    await row.getByRole("button", { name: "Draft" }).click();
    await page.getByRole("button", { name: "Move to draft" }).click();
    await expect(row.locator(".adm-badge-draft")).toHaveText("DRAFT");

    await row.getByRole("button", { name: "Archive" }).click();
    await page.getByRole("button", { name: "Archive page" }).click();
    await expect(row.locator(".adm-badge-draft")).toHaveText("ARCHIVED");

    await row.getByRole("button", { name: "Delete page" }).click();
    await page.getByRole("button", { name: "Да, удалить страницу" }).click();
    // Scoped to the pages table, not the whole page: the success toast also
    // echoes the slug and stays mounted after the row is gone.
    await expect(page.locator('[data-component="PagesCms"]').getByText(testPage.slug)).toHaveCount(0);
  });
});
