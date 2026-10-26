import { describe, expect, it } from "vitest";

import { compareSyncState } from "@/lib/sync/compare";
import { deriveCollectionWindow, deriveProductWindow } from "@/lib/sync/derive-window";
import { collectionWindowFromShopifyRemote } from "@/lib/shopify/collection-commerce-projection";

describe("derive*Window (ADR-0009)", () => {
  it("builds a collection window from columns", () => {
    const resolved = deriveCollectionWindow({
      shopifyCollectionId: "gid://shopify/Collection/1",
      name: "Local kits",
      slug: "local-kits",
      description: "Desc",
      seoTitle: null,
      seoDescription: null,
    });
    expect(resolved).toMatchObject({
      title: "Local kits",
      handle: "local-kits",
    });
  });

  it("collection with columns produces no Adopt Shopify leaf", () => {
    const working = deriveCollectionWindow({
      shopifyCollectionId: "gid://shopify/Collection/1",
      name: "Local kits",
      slug: "local-kits",
      description: "Desc",
      seoTitle: null,
      seoDescription: null,
    });
    const shopify = collectionWindowFromShopifyRemote({
      id: "gid://shopify/Collection/1",
      title: "Local kits",
      handle: "local-kits",
      descriptionHtml: "<p>Desc</p>",
      seo: { title: null, description: null },
    });
    const result = compareSyncState({
      commerceWindows: [{
        resourceType: "COLLECTION",
        resourceId: "local-7",
        ourWindow: working,
        shopifySnapshot: shopify,
      }],
      translationDifferences: [],
      productPresence: [],
      collectionPresence: [],
      locales: [
        { code: "en", shopifyLocale: "en", name: "English", nativeName: "English", isDefault: true, sortOrder: 0 },
      ],
      connected: true,
      checkedAt: "2026-10-23T10:00:00.000Z",
      runStatus: "SUCCEEDED",
      now: new Date("2026-10-23T10:01:00.000Z"),
    });
    expect(result.leaves.some((leaf) => leaf.label === "Adopt Shopify")).toBe(false);
  });

  it("builds a product window from columns + extras orphans", () => {
    const resolved = deriveProductWindow({
      shopifyProductId: "gid://shopify/Product/1",
      name: "Ring",
      slug: "ring",
      vendor: "Synarava",
      productType: "Ring",
      status: "ACTIVE",
      variants: [{
        sku: "SKU-1",
        title: "Default Title",
        priceCents: 12000,
        stockOnHand: 2,
        taxable: true,
      }],
      extras: {
        media: [{ id: "gid://shopify/MediaImage/1", alt: "Front" }],
        publications: [{ name: "Online Store" }],
      },
    });
    expect(resolved).toMatchObject({
      title: "Ring",
      handle: "ring",
      vendor: "Synarava",
    });
    expect((resolved as { media: unknown[] }).media).toHaveLength(1);
  });
});
