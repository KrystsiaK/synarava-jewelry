import { describe, expect, it } from "vitest";

import { purchaseStockSignal } from "@/lib/commerce/purchase-availability";

describe("purchaseStockSignal", () => {
  it("shows a green in-stock count when purchasable with positive qty", () => {
    expect(
      purchaseStockSignal({
        selectedVariant: { available: true, stockOnHand: 3 },
        purchasableVariantCount: 1,
      }),
    ).toEqual({
      canPurchase: true,
      showInStockDot: true,
      labelKind: "in_stock_count",
      stockOnHand: 3,
    });
  });

  it("keeps CTA enabled at zero qty without a green 0-in-stock signal (CONTINUE/untracked)", () => {
    expect(
      purchaseStockSignal({
        selectedVariant: { available: true, stockOnHand: 0 },
        purchasableVariantCount: 1,
      }),
    ).toEqual({
      canPurchase: true,
      showInStockDot: false,
      labelKind: "available",
      stockOnHand: 0,
    });
  });

  it("disables purchase when the selected variant is not available", () => {
    expect(
      purchaseStockSignal({
        selectedVariant: { available: false, stockOnHand: 0 },
        purchasableVariantCount: 1,
      }),
    ).toEqual({
      canPurchase: false,
      showInStockDot: false,
      labelKind: "out_of_stock",
      stockOnHand: 0,
    });
  });

  it("marks shopify_unavailable when no merchandise variants exist", () => {
    expect(
      purchaseStockSignal({
        selectedVariant: undefined,
        purchasableVariantCount: 0,
      }),
    ).toMatchObject({ canPurchase: false, labelKind: "shopify_unavailable" });
  });
});
