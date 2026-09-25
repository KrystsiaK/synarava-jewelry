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

    // Excludes "new" itself — the starting URL is /admin/products/new, which
    // already matches a bare [^/]+ pattern, so waitForURL would resolve
    // immediately without waiting for the actual post-save navigation.
    await page.waitForURL(/\/admin\/products\/(?!new$)[^/]+$/);
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

  test("organizes product editing into focused task tabs", async ({ page, runId }) => {
    const product = await createTestProduct(runId);

    await page.goto(`/admin/products/${product.id}`);
    await expect(page.getByRole("tab", { name: /Essentials/i })).toHaveAttribute("aria-selected", "true");
    await expect(page.locator('input[name="sku"]')).toBeVisible();

    await page.getByRole("tab", { name: /Price Sell/i }).click();
    await expect(page.getByRole("spinbutton", { name: /Price/ })).toBeVisible();
    await expect(page.getByRole("spinbutton", { name: /Compare-at price/ })).toBeVisible();
    await expect(page.getByRole("checkbox", { name: /Charge tax on this product/ })).toBeVisible();
    await expect(page.getByRole("spinbutton", { name: /^Cost/ })).toBeVisible();

    await page.getByRole("tab", { name: /Catalog/i }).click();
    await expect(page.getByText("Department & characteristics")).toBeVisible();
    await expect(page.locator('input[name="sku"]')).toBeHidden();

    await page.getByRole("tab", { name: /Content/i }).click();
    await expect(page.getByRole("button", { name: "Edit Short description" })).toBeVisible();

    await page.getByRole("tab", { name: /Media/i }).click();
    await expect(page.getByRole("region", { name: "Product gallery" })).toBeVisible();

    await page.getByRole("tab", { name: /Product page/i }).click();
    await expect(page.getByText("Materials", { exact: true })).toBeVisible();

    await page.getByRole("tab", { name: /Sync/i }).click();
    await expect(page.getByRole("region", { name: "Commerce synchronization" })).toBeVisible();

    await page.goto(`/admin/products/${product.id}#field-taxonomy-category`);
    await expect(page.getByRole("tab", { name: /Catalog/i })).toHaveAttribute("aria-selected", "true");
    await expect(page.locator("#field-taxonomy-category")).toBeVisible();
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

    // The row also carries EN/PT translation-readiness badges that reuse the
    // same .adm-badge-draft/.adm-badge-published classes — scope to the
    // actual workflow-status badge so this doesn't match more than one span.
    const workflowStatus = row.locator('[data-role="workflow-status"]');
    await row.getByRole("button", { name: "Publish" }).click();
    await page.getByRole("button", { name: "Publish product" }).click();
    await expect(workflowStatus).toHaveText("PUBLISHED");

    await row.getByRole("button", { name: "Draft" }).click();
    await page.getByRole("button", { name: "Move to draft" }).click();
    await expect(workflowStatus).toHaveText("DRAFT");

    await row.getByRole("button", { name: "Archive" }).click();
    await page.getByRole("button", { name: "Archive product" }).click();
    await expect(workflowStatus).toHaveText("ARCHIVED");

    await row.getByRole("button", { name: "Delete" }).click();
    await page.getByRole("button", { name: "Delete permanently" }).click();
    // Scoped to the products table, not the whole page: the success toast
    // also echoes the slug and stays mounted after the row is gone.
    await expect(page.locator('[data-component="ProductsCms"]').getByText(product.slug)).toHaveCount(0);
  });
});
