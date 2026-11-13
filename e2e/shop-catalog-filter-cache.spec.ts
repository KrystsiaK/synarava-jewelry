import { expect, type Locator, type Page, test } from "@playwright/test";

/**
 * Smoke: product-type tile → filtered card/counter match tile count → reload
 * keeps that equality → back restores the unfiltered count.
 *
 * Guards the IndexedDB ownership bug where scroll-persist wrote the old
 * unfiltered list under the new filter key (synarava-catalog-view). A
 * same-count-after-reload check alone would still pass on a poisoned cache.
 *
 * Also guards Browser Back after PDP: filters/sort must stay URL-owned via
 * useListState (not bare history.pushState + local useState).
 *
 * Pagination note: URL-owned filter writes remount via Next SSR `initialPage`
 * (default limit 24). CI seed has ≤6 products per type, so page 1 is complete
 * and Load more never appears — Back tests do not require / intercept Load more.
 */

const PRODUCT_COUNT_RE = /(\d+)\s+products?/i;

/** CI seed collection — see scripts/ci/seed-shop-filter-fixture.mjs */
const CI_COLLECTION_SLUG = "ci-filter";

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

type ProductTypeTilePick = { locator: Locator; count: number; href: string };

async function scanProductTypeTiles(page: Page): Promise<ProductTypeTilePick[]> {
  const tiles = productTypeTiles(page);
  await expect(tiles.first()).toBeVisible();
  const tileCount = await tiles.count();
  const found: ProductTypeTilePick[] = [];
  for (let i = 0; i < tileCount; i += 1) {
    const tile = tiles.nth(i);
    const count = parseProductCount(await tile.innerText());
    if (count === null || count <= 0) continue;
    found.push({ locator: tile, count, href: (await tile.getAttribute("href")) ?? "" });
  }
  return found;
}

async function pickNarrowestProductTypeTile(page: Page, unfilteredCount: number) {
  const found = await scanProductTypeTiles(page);
  let best: ProductTypeTilePick | null = null;
  for (const tile of found) {
    if (!best || tile.count < best.count) best = tile;
  }

  const hasSuitableTile = Boolean(best && best.count < unfilteredCount);
  if (!process.env.CI) {
    test.skip(
      !hasSuitableTile,
      "No product-type tile with a positive count strictly below the unfiltered shop total",
    );
  }
  expect(
    hasSuitableTile,
    "CI requires a product-type tile with a positive count strictly below the unfiltered shop total (seed fixture missing?)",
  ).toBe(true);

  return best!;
}

/** Prefer a multi-card type so scroll + grid restore have something to assert. */
async function pickMultiCardProductTypeTile(page: Page, unfilteredCount: number) {
  const found = await scanProductTypeTiles(page);
  let best: ProductTypeTilePick | null = null;
  for (const tile of found) {
    if (tile.count < 2 || tile.count >= unfilteredCount) continue;
    if (!best || tile.count < best.count) best = tile;
  }
  if (!best) {
    // Fall back to any narrower tile (e.g. Bracelet=1) — still exercises URL Back.
    return pickNarrowestProductTypeTile(page, unfilteredCount);
  }
  return best;
}

async function selectSortNewest(page: Page) {
  // Sort FilterDropdown keeps role=button; inactive accessible name is "Featured"
  // (inactiveLabel), not "Sort" — /^sort$/i never matches. Desktop + mobile both
  // mount filter-dropdown-sort; pick the visible instance after filter remount.
  // https://playwright.dev/docs/locators#filtering-locators
  const sortDropdown = page.getByTestId("filter-dropdown-sort").filter({ visible: true });
  await expect(sortDropdown).toBeVisible({ timeout: 10_000 });
  await sortDropdown.getByRole("button").click();
  await page.getByRole("option", { name: /newest/i }).click();
  await expect(page).toHaveURL(/sort=newest/);
}

test.describe("Shop catalog filter cache ownership", () => {
  test("product-type tile filters the grid and survives reload", async ({ page }) => {
    await page.goto("/en/shop");
    await expect(page.locator("#shop-products")).toBeVisible();

    const unfilteredCount = await readShowingCount(page);
    expect(unfilteredCount).toBeGreaterThan(0);

    const best = await pickNarrowestProductTypeTile(page, unfilteredCount);
    const tileProductCount = best.count;
    expect(best.href).toMatch(/productType=/);

    await best.locator.click();
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

  test("shop filters survive product Back (URL + cards + scroll)", async ({ page }) => {
    await page.goto("/en/shop");
    await expect(page.locator("#shop-products")).toBeVisible();

    const unfilteredCount = await readShowingCount(page);
    const best = await pickMultiCardProductTypeTile(page, unfilteredCount);
    expect(best.count).toBeGreaterThan(0);

    await best.locator.click();
    await expect(page).toHaveURL(/productType=/);
    await selectSortNewest(page);
    await expect(page).toHaveURL(/productType=/);
    await expect(page).toHaveURL(/sort=newest/);

    // SSR remount serves the full filtered page (seed ≪ limit 24) — assert cards, not Load more.
    await expect(showingCounter(page)).toHaveText(productCountLabel(best.count), { timeout: 15_000 });
    await expect(productCards(page)).toHaveCount(best.count, { timeout: 15_000 });

    await page.locator("#shop-products").scrollIntoViewIfNeeded();
    const scrollBefore = await page.evaluate(() => window.scrollY);
    expect(scrollBefore).toBeGreaterThan(0);

    const cardCountBefore = await productCards(page).count();
    const hrefBefore = page.url();

    await productCards(page).first().locator("a").first().click();
    await expect(page).toHaveURL(/\/products\//);

    await page.goBack();
    await expect(page).toHaveURL(/productType=/);
    await expect(page).toHaveURL(/sort=newest/);
    expect(new URL(page.url()).search).toBe(new URL(hrefBefore).search);

    await expect(showingCounter(page)).toHaveText(productCountLabel(best.count), { timeout: 15_000 });
    await expect(productCards(page)).toHaveCount(cardCountBefore, { timeout: 15_000 });

    await expect
      .poll(async () => page.evaluate(() => window.scrollY), { timeout: 10_000 })
      .toBeGreaterThan(Math.max(0, scrollBefore - 120));

    // Hard reload with the same filter query must keep the filtered view.
    await page.goto(hrefBefore);
    await expect(page).toHaveURL(/productType=/);
    await expect(page).toHaveURL(/sort=newest/);
    await expect(showingCounter(page)).toHaveText(productCountLabel(best.count), { timeout: 15_000 });
  });

  test("collection filters survive product Back (URL + cards + scroll)", async ({ page }) => {
    test.skip(
      process.env.CI !== "true",
      "Collection Back restore needs the CI seed collection (ci-filter); set CI=true after seeding",
    );

    await page.goto(`/en/collections/${CI_COLLECTION_SLUG}`);
    const catalog = page.locator('[data-component="CollectionProductsCatalog"]');
    await expect(catalog).toBeVisible({ timeout: 20_000 });
    await expect(catalog.locator("#shop-products")).toHaveCount(1);
    await expect(catalog.locator("#shop-products")).toBeVisible();

    const totalInCollection = await readShowingCount(page);
    expect(totalInCollection).toBeGreaterThan(0);

    // Filter 1: product type Ring (3 of 6 in the CI collection).
    const typeButton = catalog.getByRole("button", { name: /^product type$/i }).first();
    await expect(typeButton).toBeVisible({ timeout: 10_000 });
    await typeButton.click();
    await page.getByRole("option", { name: /^ring$/i }).click();
    await expect(page).toHaveURL(/productType=Ring/);

    // Filter 2: sort.
    await selectSortNewest(page);
    await expect(page).toHaveURL(/productType=Ring/);
    await expect(page).toHaveURL(/sort=newest/);

    // Counter can flash 0 during URL remount — wait for the filtered total.
    await expect
      .poll(async () => readShowingCount(page), { timeout: 15_000 })
      .toBeGreaterThan(0);
    const filteredTotal = await readShowingCount(page);
    expect(filteredTotal).toBeLessThanOrEqual(totalInCollection);
    await expect(productCards(page)).toHaveCount(filteredTotal, { timeout: 15_000 });

    await catalog.locator("#shop-products").scrollIntoViewIfNeeded();
    const scrollBefore = await page.evaluate(() => window.scrollY);
    expect(scrollBefore).toBeGreaterThan(0);

    const cardCountBefore = await productCards(page).count();
    const hrefBefore = page.url();

    await productCards(page).first().locator("a").first().click();
    await expect(page).toHaveURL(/\/products\//);

    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`/collections/${CI_COLLECTION_SLUG}`));
    await expect(page).toHaveURL(/productType=Ring/);
    await expect(page).toHaveURL(/sort=newest/);
    expect(new URL(page.url()).search).toBe(new URL(hrefBefore).search);

    await expect(showingCounter(page)).toHaveText(productCountLabel(filteredTotal), { timeout: 15_000 });
    await expect(productCards(page)).toHaveCount(cardCountBefore, { timeout: 15_000 });

    await expect
      .poll(async () => page.evaluate(() => window.scrollY), { timeout: 10_000 })
      .toBeGreaterThan(Math.max(0, scrollBefore - 120));

    await page.goto(hrefBefore);
    await expect(page).toHaveURL(/productType=Ring/);
    await expect(page).toHaveURL(/sort=newest/);
    await expect(showingCounter(page)).toHaveText(productCountLabel(filteredTotal), { timeout: 15_000 });
  });
});
