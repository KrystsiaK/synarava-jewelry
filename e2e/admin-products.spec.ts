import { hasAdminCredentials } from "./support/auth";
import { createTestProduct, testDataPrefix } from "./support/factories";
import { expect, test } from "./support/fixtures";

// Runs in the "chromium-admin" project (see playwright.config.ts), which
// starts every test already authenticated via the storage state produced by
// support/auth.setup.ts.
test.describe("Admin products CRUD", () => {
  test.beforeEach(() => {
    test.skip(!hasAdminCredentials(), "Local admin credentials are not configured.");
  });

  test("creates a product from the create form with the required fields", async ({ page, runId }) => {
    const prefix = testDataPrefix(runId);
    const name = `E2E Create Product ${runId}`;

    await page.goto("/admin/products/new");
    await page.locator('input[name="name"]').fill(name);
    await page.locator('input[name="slug"]').fill(`${prefix}-product-create`);
    await page.locator('input[name="sku"]').fill(`${prefix}-SKU-CREATE`.toUpperCase());
    await page.locator('input[name="price"]').fill("45.00");

    // The draft-autosave (700ms debounce, see use-draft-autosave.ts) can still
    // have a flush in flight or queued right after the fields above are
    // filled. Submitting while one is pending races it: the create below can
    // land correctly and then get silently overwritten by a stale queued
    // autosave reading the just-reset (blank) form. Let the debounce fire and
    // its request(s) fully settle before submitting.
    await page.waitForTimeout(750);
    await page.waitForLoadState("networkidle");
    // "Save product" renders twice (header and footer of the same form).
    await page.getByRole("button", { name: "Save product" }).first().click();
    await page.getByRole("button", { name: "Continue and save" }).click();

    await page.waitForURL(/\/admin\/products\/[^/]+$/);
    await expect(page.getByRole("heading", { name }).first()).toBeVisible();
  });

  test("saves an existing product and keeps the editor available", async ({ page, runId }) => {
    const product = await createTestProduct(runId);
    const updatedName = `E2E Updated Product ${runId}`;

    await page.goto(`/admin/products/${product.id}`);
    await page.locator('input[name="name"]').fill(updatedName);
    await page.getByRole("button", { name: "Save product" }).first().click();
    await page.getByRole("button", { name: "Yes, save changes" }).click();

    await expect(page.getByRole("heading", { name: updatedName }).first()).toBeVisible();
    await expect(page.getByText("Product saved locally. Commerce changes are ready to push.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Save product" }).first()).toBeVisible();
  });

  test("publishes, drafts, archives, and deletes a product from the products table", async ({ page, runId }) => {
    // updateProductStatusAction refuses to publish without an image, so the
    // fixture needs one even though nothing renders/validates it here.
    const product = await createTestProduct(runId, {
      status: "DRAFT",
      imageUrl: "https://example.com/e2e-fixture.jpg",
    });

    await page.goto("/admin/products");
    const row = page
      .locator("div")
      .filter({ hasText: product.slug })
      .filter({ has: page.getByRole("button", { name: "Details" }) })
      .last();

    await row.getByRole("button", { name: "Publish" }).click();
    await page.getByRole("button", { name: "Publish product" }).click();
    await expect(row.locator(".adm-badge-published")).toHaveText("PUBLISHED");

    await row.getByRole("button", { name: "Draft" }).click();
    await page.getByRole("button", { name: "Move to draft" }).click();
    await expect(row.locator(".adm-badge-draft")).toHaveText("DRAFT");

    await row.getByRole("button", { name: "Archive" }).click();
    await page.getByRole("button", { name: "Archive product" }).click();
    await expect(row.locator(".adm-badge-draft")).toHaveText("ARCHIVED");

    await row.getByRole("button", { name: "Delete" }).click();
    await page.getByRole("button", { name: "Delete permanently" }).click();
    // Scoped to the products table, not the whole page: the success toast
    // also echoes the slug and stays mounted after the row is gone.
    await expect(page.locator('[data-component="ProductsCms"]').getByText(product.slug)).toHaveCount(0);
  });
});
