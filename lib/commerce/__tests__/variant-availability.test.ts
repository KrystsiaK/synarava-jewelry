import { describe, expect, it } from "vitest";

import {
  isVariantPurchasable,
  shopifyInventoryQuantityFromSnapshot,
  withShopifyInventoryAvailability,
} from "../variant-availability";

function variant(overrides: Partial<Parameters<typeof isVariantPurchasable>[0]> = {}) {
  return { status: "ACTIVE", stockOnHand: 0, inventoryPolicy: "DENY", tracked: true, ...overrides };
}

describe("isVariantPurchasable", () => {
  it("is purchasable when tracked DENY stock is positive and Shopify copy is missing", () => {
    expect(isVariantPurchasable(variant({ stockOnHand: 1 }))).toBe(true);
  });

  it("is not purchasable when tracked DENY stock is zero", () => {
    expect(isVariantPurchasable(variant({ stockOnHand: 0 }))).toBe(false);
  });

  it("allows overselling when the policy is CONTINUE, even at zero or negative stock", () => {
    expect(isVariantPurchasable(variant({ stockOnHand: 0, inventoryPolicy: "CONTINUE" }))).toBe(true);
    expect(isVariantPurchasable(variant({ stockOnHand: -3, inventoryPolicy: "CONTINUE" }))).toBe(true);
    expect(
      isVariantPurchasable(
        variant({ stockOnHand: 0, inventoryPolicy: "CONTINUE", shopifyInventoryQuantity: 0 }),
      ),
    ).toBe(true);
  });

  it("is always purchasable when inventory isn't tracked, regardless of policy", () => {
    expect(isVariantPurchasable(variant({ stockOnHand: 0, tracked: false }))).toBe(true);
    expect(
      isVariantPurchasable(variant({ stockOnHand: 0, tracked: false, shopifyInventoryQuantity: 0 })),
    ).toBe(true);
  });

  it("is never purchasable when the variant itself isn't active", () => {
    expect(
      isVariantPurchasable(
        variant({ status: "DRAFT", stockOnHand: 5, inventoryPolicy: "CONTINUE", tracked: false }),
      ),
    ).toBe(false);
  });

  it("requires both ours and Shopify inventory > 0 when Shopify copy is present (DENY)", () => {
    expect(
      isVariantPurchasable(variant({ stockOnHand: 1, shopifyInventoryQuantity: 1 })),
    ).toBe(true);
    expect(
      isVariantPurchasable(variant({ stockOnHand: 1, shopifyInventoryQuantity: 0 })),
    ).toBe(false);
    expect(
      isVariantPurchasable(variant({ stockOnHand: 0, shopifyInventoryQuantity: 1 })),
    ).toBe(false);
  });

  it("falls back to ours when Shopify inventory is omitted (missing copy)", () => {
    expect(isVariantPurchasable(variant({ stockOnHand: 1 }))).toBe(true);
    expect(isVariantPurchasable(variant({ stockOnHand: 0 }))).toBe(false);
  });
});

describe("shopifyInventoryQuantityFromSnapshot", () => {
  const snapshot = {
    variants: [
      { id: "gid://shopify/ProductVariant/1", inventoryQuantity: 4 },
      { id: "gid://shopify/ProductVariant/2", inventoryQuantity: 0 },
      { id: "gid://shopify/ProductVariant/3" },
    ],
  };

  it("reads quantity for a matching variant", () => {
    expect(
      shopifyInventoryQuantityFromSnapshot(snapshot, "gid://shopify/ProductVariant/1"),
    ).toBe(4);
    expect(
      shopifyInventoryQuantityFromSnapshot(snapshot, "gid://shopify/ProductVariant/2"),
    ).toBe(0);
  });

  it("returns 0 when the variant exists but quantity is missing", () => {
    expect(
      shopifyInventoryQuantityFromSnapshot(snapshot, "gid://shopify/ProductVariant/3"),
    ).toBe(0);
  });

  it("returns undefined when the variant is absent from the snapshot", () => {
    expect(
      shopifyInventoryQuantityFromSnapshot(snapshot, "gid://shopify/ProductVariant/99"),
    ).toBeUndefined();
    expect(shopifyInventoryQuantityFromSnapshot(null, "gid://shopify/ProductVariant/1")).toBeUndefined();
    expect(shopifyInventoryQuantityFromSnapshot(snapshot, null)).toBeUndefined();
  });
});

describe("withShopifyInventoryAvailability", () => {
  it("attaches Shopify quantity when the snapshot has the variant", () => {
    expect(
      withShopifyInventoryAvailability(
        {
          status: "ACTIVE",
          stockOnHand: 2,
          inventoryPolicy: "DENY",
          tracked: true,
          shopifyVariantId: "gid://shopify/ProductVariant/1",
        },
        { variants: [{ id: "gid://shopify/ProductVariant/1", inventoryQuantity: 7 }] },
      ),
    ).toEqual({
      status: "ACTIVE",
      stockOnHand: 2,
      inventoryPolicy: "DENY",
      tracked: true,
      shopifyInventoryQuantity: 7,
    });
  });
});
