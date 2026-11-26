/**
 * Shared storefront purchase availability presentation.
 * One rule for stock label + CTA disable — no per-button ad-hoc checks.
 *
 * `available` comes from catalog (`isVariantPurchasable` + Shopify snapshot).
 * When available but local count is 0 (CONTINUE / untracked), keep the CTA
 * enabled but never show a green “0 in stock” signal.
 */

export type PurchaseStockSignal = {
  /** Whether add-to-cart may proceed for the selected line. */
  canPurchase: boolean;
  /** Green stock dot only when there is a positive count. */
  showInStockDot: boolean;
  /** Kind of label the purchase panel should render. */
  labelKind:
    | "in_stock_count"
    | "available"
    | "out_of_stock"
    | "select_option"
    | "shopify_unavailable";
  stockOnHand: number;
};

export function purchaseStockSignal(input: {
  selectedVariant: { available: boolean; stockOnHand: number } | null | undefined;
  purchasableVariantCount: number;
}): PurchaseStockSignal {
  const { selectedVariant, purchasableVariantCount } = input;

  if (purchasableVariantCount === 0) {
    return {
      canPurchase: false,
      showInStockDot: false,
      labelKind: "shopify_unavailable",
      stockOnHand: 0,
    };
  }

  if (!selectedVariant) {
    return {
      canPurchase: false,
      showInStockDot: false,
      labelKind: "select_option",
      stockOnHand: 0,
    };
  }

  if (!selectedVariant.available) {
    return {
      canPurchase: false,
      showInStockDot: false,
      labelKind: "out_of_stock",
      stockOnHand: selectedVariant.stockOnHand,
    };
  }

  if (selectedVariant.stockOnHand > 0) {
    return {
      canPurchase: true,
      showInStockDot: true,
      labelKind: "in_stock_count",
      stockOnHand: selectedVariant.stockOnHand,
    };
  }

  // Oversell / untracked at zero: purchasable, but no green “0 in stock”.
  return {
    canPurchase: true,
    showInStockDot: false,
    labelKind: "available",
    stockOnHand: selectedVariant.stockOnHand,
  };
}
