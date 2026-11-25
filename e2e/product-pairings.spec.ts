import { expect } from "@playwright/test";

import {
  createTestProduct,
  createTestProductVariant,
  db,
} from "./support/factories";
import { test } from "./support/fixtures";

/**
 * Shopify mocked: POST /api/cart/items is fulfilled locally — no Storefront API.
 * Wired in CI alongside smoke (see .github/workflows/ci.yml).
 */
test.describe("product pairings", () => {
  test("create link → both PDPs → select → kit cart request", async ({
    page,
    runId,
  }) => {
    const base = await createTestProduct(runId, {
      name: `E2E Pair Base ${runId}`,
      status: "ACTIVE",
      visibility: "PUBLIC",
      publishedAt: new Date(),
      imageUrl: "https://placehold.co/800x1000/png",
      priceCents: 5000,
    });
    const addon = await createTestProduct(runId, {
      name: `E2E Pair Addon ${runId}`,
      status: "ACTIVE",
      visibility: "PUBLIC",
      publishedAt: new Date(),
      imageUrl: "https://placehold.co/800x1000/png",
      priceCents: 2500,
    });

    const baseVariant = await createTestProductVariant(base.id, {
      sku: `${base.sku}-V`,
      status: "ACTIVE",
      stockOnHand: 5,
      priceCents: 5000,
    });
    const addonVariant = await createTestProductVariant(addon.id, {
      sku: `${addon.sku}-V`,
      status: "ACTIVE",
      stockOnHand: 5,
      priceCents: 2500,
    });

    await db.productVariant.update({
      where: { id: baseVariant.id },
      data: { shopifyVariantId: `gid://shopify/ProductVariant/e2e-base-${runId}` },
    });
    await db.productVariant.update({
      where: { id: addonVariant.id },
      data: { shopifyVariantId: `gid://shopify/ProductVariant/e2e-addon-${runId}` },
    });

    await db.productPairing.create({
      data: {
        baseProductId: base.id,
        addonProductId: addon.id,
        sortOrder: 0,
      },
    });

    let kitBody: unknown = null;
    await page.route("**/api/cart/items", async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }
      kitBody = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          count: 2,
          warnings: [],
          ecommerce: { currency: "EUR", value: 75, items: [] },
        }),
      });
    });

    await page.goto(`/en/products/${base.slug}`);
    const carousel = page.locator('[data-component="ProductPairingCarousel"]');
    await expect(carousel).toBeVisible();
    await carousel.getByRole("button").first().click();
    await expect(page).toHaveURL(new RegExp(`[?&]with=${addon.slug}`));

    await page.locator('[data-component="ProductPurchasePanel"][data-pairing="kit"]').first()
      .getByRole("button", { name: /Add set|Добавить комплект|Adicionar conjunto|Set hinzufügen|Ajouter le set|Dodaj komplet/i })
      .click();

    await expect.poll(() => kitBody).not.toBeNull();
    expect(kitBody).toMatchObject({
      lines: expect.arrayContaining([
        expect.objectContaining({ productSlug: base.slug }),
        expect.objectContaining({ productSlug: addon.slug }),
      ]),
    });
    expect((kitBody as { lines: unknown[] }).lines).toHaveLength(2);

    await page.goto(`/en/products/${addon.slug}`);
    await expect(page.locator('[data-component="ProductPairingCarousel"]')).toBeVisible();
  });
});
