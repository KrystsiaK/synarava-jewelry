import { expect, test } from "@playwright/test";

/**
 * Smoke: product-type tile → filtered card count → reload must keep that count.
 * Guards the IndexedDB ownership bug where scroll-persist wrote the old list
 * under the new filter key (synarava-catalog-view).
 */
test.describe("Shop catalog filter cache ownership", () => {
  test("product-type tile filters the grid and survives reload", async ({ page }) => {
    await page.goto("/en/shop");

    const typeTile = page.locator("#shop-product-type-title")
      .locator("xpath=ancestor::section[1]")
      .locator('a[href*="productType="]')
      .first();
    await expect(typeTile).toBeVisible();

    const href = await typeTile.getAttribute("href");
    expect(href).toMatch(/productType=/);

    await typeTile.click();
    await expect(page).toHaveURL(/productType=/);
    await expect(page.locator("#shop-products")).toBeVisible();

    const grid = page.locator("#shop-product-grid");
    await expect(grid).toBeVisible({ timeout: 15_000 });

    const cards = grid.locator("[data-product-id]");
    await expect(cards.first()).toBeVisible();
    const filteredCount = await cards.count();
    expect(filteredCount).toBeGreaterThan(0);

    // Unfiltered shop is typically larger; if the tile's type is rare this may
    // equal the unfiltered count — still assert stability across reload.
    await page.reload();
    await expect(page).toHaveURL(/productType=/);
    await expect(grid).toBeVisible({ timeout: 15_000 });
    await expect(cards).toHaveCount(filteredCount);
  });
});
