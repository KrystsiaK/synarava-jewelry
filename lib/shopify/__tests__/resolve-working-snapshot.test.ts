import { describe, expect, it } from "vitest";

import { compareSyncState } from "@/lib/sync/compare";
import {
  resolveCollectionWorkingSnapshot,
  resolveProductWorkingSnapshot,
} from "@/lib/shopify/resolve-working-snapshot";
import { collectionWindowFromShopifyRemote } from "@/lib/shopify/collection-commerce-projection";

describe("resolveWorkingSnapshot", () => {
  it("builds a collection window from columns when workingSnapshot is null", () => {
    const resolved = resolveCollectionWorkingSnapshot({
      workingSnapshot: null,
      shopifySnapshot: { title: "Remote", handle: "remote" },
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

  it("collection with columns + null workingSnapshot produces no Adopt Shopify leaf", () => {
    const working = resolveCollectionWorkingSnapshot({
      workingSnapshot: null,
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
        workingSnapshot: working,
        shopifySnapshot: shopify,
      }],
      translationDifferences: [],
      productPresence: [],
      collectionPresence: [],
      locales: [],
      connected: true,
      checkedAt: "2026-10-25T12:00:00.000Z",
      runStatus: "SUCCEEDED",
      now: new Date("2026-10-25T12:01:00.000Z"),
    });
    expect(result.leaves.some((leaf) => leaf.fieldKey === "commerce:adopt-shopify")).toBe(false);
  });

  it("create-in-Shopify window equals Shopify remote → zero conflict leaves", () => {
    const pushed = resolveCollectionWorkingSnapshot({
      workingSnapshot: null,
      shopifyCollectionId: "gid://shopify/Collection/70",
      name: "Pets",
      slug: "pets",
      description: "Cute",
      seoTitle: null,
      seoDescription: null,
    });
    // After create we persist `pushed`; refresh stores the Shopify remote window.
    // When they match, post-create check must show ZERO conflicts.
    const shopify = collectionWindowFromShopifyRemote({
      id: "gid://shopify/Collection/70",
      title: "Pets",
      handle: "pets",
      descriptionHtml: String(
        (pushed as { descriptionHtml?: string }).descriptionHtml ?? "",
      ),
      seo: { title: null, description: null },
    });
    const result = compareSyncState({
      commerceWindows: [{
        resourceType: "COLLECTION",
        resourceId: "c-pets",
        workingSnapshot: pushed,
        shopifySnapshot: shopify,
      }],
      translationDifferences: [],
      productPresence: [],
      collectionPresence: [],
      locales: [],
      connected: true,
      checkedAt: "2026-10-25T12:00:00.000Z",
      runStatus: "SUCCEEDED",
      now: new Date("2026-10-25T12:01:00.000Z"),
    });
    expect(result.leaves).toHaveLength(0);
  });

  it("builds a product window from columns when workingSnapshot is null", () => {
    const resolved = resolveProductWorkingSnapshot({
      workingSnapshot: null,
      shopifySnapshot: { title: "Remote" },
      name: "Lava Ring",
      slug: "lava-ring",
      vendor: "Synarava",
      productType: "Ring",
      priceCents: 12000,
      variant: { sku: "LR-1", priceCents: 12000, taxable: true, inventoryQuantity: 2 },
    });
    expect(resolved).toMatchObject({
      title: "Lava Ring",
      handle: "lava-ring",
    });
  });
});
