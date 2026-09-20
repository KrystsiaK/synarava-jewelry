import { hasAdminCredentials } from "./support/auth";
import { createTestCollection, testDataPrefix } from "./support/factories";
import { expect, test } from "./support/fixtures";
import { validPngFixture } from "./support/media";

// Runs in the "chromium-admin" project (see playwright.config.ts), which
// starts every test already authenticated via the storage state produced by
// support/auth.setup.ts.
test.describe("Admin collections CRUD", () => {
  test.beforeEach(() => {
    test.skip(!hasAdminCredentials(), "Local admin credentials are not configured.");
  });

  test("creates a collection from the create form with a hero image", async ({ page, runId }) => {
    const prefix = testDataPrefix(runId);
    const name = `E2E Create Collection ${runId}`;
    const fixture = validPngFixture();

    await page.goto("/admin/collections/new");
    // Name/Collection summary/Manifesto/Search summary are controlled
    // locale-switching fields with no `name` attribute of their own (see
    // collection-fields.tsx) — a hidden readonly mirror carries that name
    // for submission instead. Target the real, visible field by its label.
    await page.getByLabel(/^Name\*/).fill(name);
    await page.locator('input[name="slug"]').fill(`${prefix}-collection-create`);
    await page.locator('input[name="code"]').fill("E2E-COL");
    await page.getByLabel("Collection summary").fill("E2E collection summary.");
    await page.getByLabel("Manifesto").fill("E2E collection manifesto.");
    await page.getByLabel("Search summary").fill("E2E search summary.");
    // The draft-autosave (700ms debounce, see use-draft-autosave.ts) can still
    // have a flush in flight or queued right after the fields above are
    // filled. Submitting while one is pending races it: the create below can
    // land correctly and then get silently overwritten by a stale queued
    // autosave reading the just-reset (blank) form. Let the debounce fire and
    // its request(s) fully settle before touching anything else.
    await page.waitForTimeout(750);
    await page.waitForLoadState("networkidle");
    await page.locator('input[name="heroImageFile"]').setInputFiles(fixture.path);
    await page.getByRole("button", { name: "Save collection" }).click();
    await page.getByRole("button", { name: "Create collection" }).click();

    // Excludes "new" itself — the starting URL is /admin/collections/new,
    // which already matches a bare [^/]+ pattern, so waitForURL would
    // resolve immediately without waiting for the actual post-save
    // navigation.
    await page.waitForURL(/\/admin\/collections\/(?!new$)[^/]+$/);
    await expect(page.getByRole("heading", { name }).first()).toBeVisible();
  });

  test("publishes, archives, and deletes a collection from the collections table", async ({ page, runId }) => {
    const collection = await createTestCollection(runId, { status: "DRAFT" });

    await page.goto("/admin/collections");
    const row = page
      .locator("div")
      .filter({ hasText: collection.slug })
      .filter({ has: page.getByRole("button", { name: "Details" }) })
      .last();

    await row.getByRole("button", { name: "Publish" }).click();
    await page.getByRole("button", { name: "Publish collection" }).click();
    await expect(row.locator(".adm-badge-published")).toHaveText("PUBLISHED");

    await row.getByRole("button", { name: "Archive" }).click();
    await page.getByRole("button", { name: "Archive collection" }).click();
    await expect(row.locator(".adm-badge-draft")).toHaveText("ARCHIVED");

    await row.getByRole("button", { name: "Delete" }).click();
    await page.getByRole("button", { name: "Delete permanently" }).click();
    // Scoped to the collections table, not the whole page: the success toast
    // also echoes the slug and stays mounted after the row is gone.
    await expect(page.locator('[data-component="CollectionsCms"]').getByText(collection.slug)).toHaveCount(0);
  });
});
