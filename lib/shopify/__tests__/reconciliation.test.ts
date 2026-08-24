import { describe, expect, it } from "vitest";

import {
  classifyRemoteReconciliationAction,
  compareVariantCommerce,
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
