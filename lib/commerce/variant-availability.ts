// Shopify sells a variant with zero (or negative) stock when inventory isn't
// tracked at all, or when the merchant explicitly opted into overselling
// (inventoryPolicy CONTINUE). stockOnHand alone under-reports what's actually
// purchasable. See https://shopify.dev/docs/api/liquid/objects/product.
export type VariantAvailabilityInput = {
  status: string;
  stockOnHand: number;
  inventoryPolicy: string;
  tracked: boolean;
};

export function isVariantPurchasable(variant: VariantAvailabilityInput): boolean {
  if (variant.status !== "ACTIVE") return false;
  if (!variant.tracked) return true;
  if (variant.inventoryPolicy === "CONTINUE") return true;
  return variant.stockOnHand > 0;
}
