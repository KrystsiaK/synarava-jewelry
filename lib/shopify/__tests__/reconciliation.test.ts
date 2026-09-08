import { describe, expect, it } from "vitest";

import {
  classifyRemoteReconciliationAction,
  compareVariantCommerce,
  diffCollectionMembership,
  isSynaravaProductAccessible,
  pickShopifyProductImageUrl,
  refreshShopifyProductAfterPush,
  synaravaVisibilityForShopifyProduct,
  variantCommerceChangeLabels,
  type LocalCommerceVariant,
  type RemoteCommerceVariant,
} from "@/lib/shopify/reconciliation";

const localVariant: LocalCommerceVariant = {
  shopifyVariantId: "gid://shopify/ProductVariant/1",
  sku: "FORM-001",
  priceCents: 12900,
  compareAtCents: null,
  stockOnHand: 4,
};

const remoteVariant: RemoteCommerceVariant = {
  id: "gid://shopify/ProductVariant/1",
  sku: "FORM-001",
  price: "129.00",
  compareAtPrice: null,
  inventoryQuantity: 4,
};

describe("compareVariantCommerce", () => {
  it("treats identical commerce variants as synchronized", () => {
    expect(compareVariantCommerce([localVariant], [remoteVariant])).toEqual([]);
  });

  it("detects an inventory-only Shopify change", () => {
    const differences = compareVariantCommerce(
      [localVariant],
      [{ ...remoteVariant, inventoryQuantity: 9 }],
    );

    expect(differences).toEqual([
      {
        variant: "FORM-001",
        field: "inventoryQuantity",
        local: 4,
        shopify: 9,
      },
    ]);
    expect(variantCommerceChangeLabels(differences)).toEqual(["Available quantity"]);
  });

  it("detects variants added or removed in Shopify", () => {
    expect(compareVariantCommerce([localVariant], [])).toEqual([
      {
        variant: "FORM-001",
        field: "variant",
        local: "Present",
        shopify: "Missing",
      },
    ]);
  });
});

describe("classifyRemoteReconciliationAction", () => {
  it("offers a pull for Shopify-only changes", () => {
    expect(
      classifyRemoteReconciliationAction({ localHasChanges: false, remoteHasChanges: true }),
    ).toBe("UPDATE_LOCAL");
  });

  it("marks simultaneous local and Shopify changes as a conflict", () => {
    expect(
      classifyRemoteReconciliationAction({ localHasChanges: true, remoteHasChanges: true }),
    ).toBe("CONFLICT");
  });

  it("keeps an unresolved conflict visible", () => {
    expect(
      classifyRemoteReconciliationAction({
        hasUnresolvedConflict: true,
        localHasChanges: true,
        remoteHasChanges: false,
      }),
    ).toBe("CONFLICT");
  });
});

describe("Shopify storefront projection", () => {
  it("keeps unlisted products accessible by direct URL but out of public listings", () => {
    expect(isSynaravaProductAccessible("ACTIVE", "PUBLIC")).toBe(true);
    expect(isSynaravaProductAccessible("UNLISTED", "UNLISTED")).toBe(true);
    expect(isSynaravaProductAccessible("UNLISTED", "PRIVATE")).toBe(false);
    expect(isSynaravaProductAccessible("DRAFT", "PRIVATE")).toBe(false);
  });

  it("requires both ACTIVE status and an Online Store publication", () => {
    expect(synaravaVisibilityForShopifyProduct("ACTIVE", true)).toBe("PUBLIC");
    expect(synaravaVisibilityForShopifyProduct("ACTIVE", false)).toBe("PRIVATE");
    expect(synaravaVisibilityForShopifyProduct("DRAFT", true)).toBe("PRIVATE");
    expect(synaravaVisibilityForShopifyProduct("ARCHIVED", true)).toBe("PRIVATE");
    expect(synaravaVisibilityForShopifyProduct("UNLISTED", true)).toBe("UNLISTED");
    expect(synaravaVisibilityForShopifyProduct("UNLISTED", false)).toBe("PRIVATE");
  });

  it("refreshes the product after all Shopify mutations before persisting the snapshot", async () => {
    const initial = { id: "gid://shopify/Product/1", updatedAt: "before" };
    const refreshed = { id: initial.id, updatedAt: "after" };

    await expect(refreshShopifyProductAfterPush(initial, async () => refreshed)).resolves.toBe(refreshed);
    await expect(refreshShopifyProductAfterPush(initial, async () => null)).resolves.toBe(initial);
  });

  it("uses the first Shopify image media when no featured image is set", () => {
    expect(
      pickShopifyProductImageUrl({
        featuredImageUrl: null,
        media: [
          { mediaContentType: "VIDEO", imageUrl: "https://cdn.shopify.com/video-preview.jpg" },
          { mediaContentType: "IMAGE", imageUrl: "https://cdn.shopify.com/product.jpg" },
        ],
      }),
    ).toBe("https://cdn.shopify.com/product.jpg");
  });
});

describe("diffCollectionMembership", () => {
  it("reports nothing to change when membership already matches", () => {
    expect(diffCollectionMembership(["gid://shopify/Collection/1"], ["gid://shopify/Collection/1"]))
      .toEqual({ toJoin: [], toLeave: [] });
  });

  it("joins collections that are desired but not yet linked", () => {
    expect(diffCollectionMembership(["gid://shopify/Collection/1"], [])).toEqual({
      toJoin: ["gid://shopify/Collection/1"],
      toLeave: [],
    });
  });

  it("leaves collections that are linked but no longer desired", () => {
    expect(diffCollectionMembership([], ["gid://shopify/Collection/1"])).toEqual({
      toJoin: [],
      toLeave: ["gid://shopify/Collection/1"],
    });
  });

  it("computes join and leave sets independently for a partial overlap", () => {
    expect(
      diffCollectionMembership(
        ["gid://shopify/Collection/1", "gid://shopify/Collection/2"],
        ["gid://shopify/Collection/2", "gid://shopify/Collection/3"],
      ),
    ).toEqual({
      toJoin: ["gid://shopify/Collection/1"],
      toLeave: ["gid://shopify/Collection/3"],
    });
  });
});
