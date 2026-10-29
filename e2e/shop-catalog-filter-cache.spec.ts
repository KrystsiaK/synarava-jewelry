import { expect, type Locator, type Page, test } from "@playwright/test";

/**
 * Smoke: product-type tile → filtered card/counter match tile count → reload
 * keeps that equality → back restores the unfiltered count.
 *
 * Guards the IndexedDB ownership bug where scroll-persist wrote the old
 * unfiltered list under the new filter key (synarava-catalog-view). A
 * same-count-after-reload check alone would still pass on a poisoned cache.
 */

const PRODUCT_COUNT_RE = /(\d+)\s+products?/i;

function parseProductCount(text: string | null | undefined): number | null {
  if (!text) return null;
  const match = text.match(PRODUCT_COUNT_RE);
  if (!match) return null;
  const count = Number(match[1]);
  return Number.isFinite(count) ? count : null;
}

function productTypeTiles(page: Page): Locator {
  return page
    .locator("#shop-product-type-title")
    .locator("xpath=ancestor::section[1]")
    .locator('a[href*="productType="]');
}

function productCards(page: Page): Locator {
  return page.locator("#shop-product-grid [data-product-id]");
}

/** Filter-bar “Showing N products” (desktop + mobile both use aria-live). */
function showingCounter(page: Page): Locator {
  return page.locator('[aria-live="polite"]').filter({ hasText: PRODUCT_COUNT_RE }).first();
}

async function readShowingCount(page: Page): Promise<number> {
  const counter = showingCounter(page);
  await expect(counter).toBeVisible({ timeout: 15_000 });
  const count = parseProductCount(await counter.innerText());
  expect(count, "could not parse on-page product counter").not.toBeNull();
  return count!;
}

function productCountLabel(count: number): RegExp {
  return new RegExp(`\\b${count}\\s+product${count === 1 ? "" : "s"}\\b`, "i");
}

async function expectFilteredEqualsTile(page: Page, tileCount: number) {
  const grid = page.locator("#shop-product-grid");
  await expect(grid).toBeVisible({ timeout: 15_000 });

  const cards = productCards(page);
  await expect(cards.first()).toBeVisible({ timeout: 15_000 });
  await expect(cards).toHaveCount(tileCount);

  // Auto-retries while the remounted catalog fetches and updates totalCount.
  await expect(showingCounter(page)).toHaveText(productCountLabel(tileCount), { timeout: 15_000 });
}

test.describe("Shop catalog filter cache ownership", () => {
  test("product-type tile filters the grid and survives reload", async ({ page }) => {
    await page.goto("/en/shop");
    await expect(page.locator("#shop-products")).toBeVisible();

    const unfilteredCount = await readShowingCount(page);
    expect(unfilteredCount).toBeGreaterThan(0);

    const tiles = productTypeTiles(page);
    await expect(tiles.first()).toBeVisible();
    const tileCount = await tiles.count();

    let best: { locator: Locator; count: number; href: string } | null = null;
    for (let i = 0; i < tileCount; i += 1) {
      const tile = tiles.nth(i);
      const count = parseProductCount(await tile.innerText());
      if (count === null || count <= 0) continue;
      if (!best || count < best.count) {
        const href = (await tile.getAttribute("href")) ?? "";
        best = { locator: tile, count, href };
      }
    }

    test.skip(
      !best || best.count >= unfilteredCount,
      "No product-type tile with a positive count strictly below the unfiltered shop total",
    );

    const tileProductCount = best!.count;
    expect(best!.href).toMatch(/productType=/);

    await best!.locator.click();
    await expect(page).toHaveURL(/productType=/);
    await expect(page.locator("#shop-products")).toBeVisible();

    await expectFilteredEqualsTile(page, tileProductCount);
    expect(tileProductCount).toBeLessThan(unfilteredCount);

    await page.reload();
    await expect(page).toHaveURL(/productType=/);
    await expectFilteredEqualsTile(page, tileProductCount);
    expect(tileProductCount).toBeLessThan(unfilteredCount);

    await page.goBack();
    await expect(page).not.toHaveURL(/productType=/);
    await expect(showingCounter(page)).toHaveText(productCountLabel(unfilteredCount), {
      timeout: 15_000,
    });
  });
});
