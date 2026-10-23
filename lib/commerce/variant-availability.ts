// Shopify sells a variant with zero (or negative) stock when inventory isn't
// tracked at all, or when the merchant explicitly opted into overselling
// (inventoryPolicy CONTINUE). stockOnHand alone under-reports what's actually
// purchasable. See https://shopify.dev/docs/api/liquid/objects/product.
//
// After sync-unification PR1, Synarava stockOnHand is ours (sales decrement /
// human Apply) and Shopify inventory lives in shopifySnapshot. Storefront
// availability requires BOTH > 0 when tracked + DENY; missing Shopify copy
// falls back to ours so a stale snapshot cannot disable the whole shop.

export type VariantAvailabilityInput = {
  status: string;
  stockOnHand: number;
  inventoryPolicy: string;
  tracked: boolean;
  /**
   * Shopify `inventoryQuantity` from `shopifySnapshot` for this variant.
   * Omit (`undefined`) when the Shopify copy is missing — fall back to ours.
   */
  shopifyInventoryQuantity?: number;
};

/** Dual stock gate (ours ∧ Shopify) without status — used by add-to-cart for ACTIVE/UNLISTED. */
export function isVariantStockAvailable(
  variant: Omit<VariantAvailabilityInput, "status">,
): boolean {
  if (!variant.tracked) return true;
  if (variant.inventoryPolicy === "CONTINUE") return true;
  if (variant.stockOnHand <= 0) return false;
  if (variant.shopifyInventoryQuantity === undefined) return true;
  return variant.shopifyInventoryQuantity > 0;
}

export function isVariantPurchasable(variant: VariantAvailabilityInput): boolean {
  if (variant.status !== "ACTIVE") return false;
  return isVariantStockAvailable(variant);
}

/** Read Shopify inventoryQuantity for a variant GID from shopifySnapshot. */
export function shopifyInventoryQuantityFromSnapshot(
  shopifySnapshot: unknown,
  shopifyVariantId: string | null | undefined,
): number | undefined {
  if (!shopifyVariantId) return undefined;
  if (!shopifySnapshot || typeof shopifySnapshot !== "object" || Array.isArray(shopifySnapshot)) {
    return undefined;
  }
  const variants = (shopifySnapshot as Record<string, unknown>).variants;
  if (!Array.isArray(variants)) return undefined;

  for (const item of variants) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    if (row.id !== shopifyVariantId) continue;
    if (typeof row.inventoryQuantity === "number" && Number.isFinite(row.inventoryQuantity)) {
      return row.inventoryQuantity;
    }
    // Variant present in Shopify copy but quantity missing → treat as 0.
    return 0;
  }
  return undefined;
}

/** Merge local variant fields with optional Shopify inventory from snapshot. */
export function withShopifyInventoryAvailability<
  T extends {
    stockOnHand: number;
    inventoryPolicy: string;
    tracked: boolean;
    status: string;
    shopifyVariantId?: string | null;
  },
>(variant: T, shopifySnapshot: unknown): VariantAvailabilityInput {
  return {
    status: variant.status,
    stockOnHand: variant.stockOnHand,
    inventoryPolicy: variant.inventoryPolicy,
    tracked: variant.tracked,
    shopifyInventoryQuantity: shopifyInventoryQuantityFromSnapshot(
      shopifySnapshot,
      variant.shopifyVariantId,
    ),
  };
}
