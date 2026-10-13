/**
 * Local Product.sku placeholders used until sku-api reserve/confirm.
 * Never treat these as Shopify commerce SKUs when the SKU API is configured.
 */

const LEGACY_DRAFT_SKU = /^SKU-[a-z0-9]+-[a-z0-9]+$/i;
const PENDING_SKU = /^PENDING-[a-z0-9]+-[a-z0-9]+$/i;

export function isPendingCommerceSku(sku: string): boolean {
  const trimmed = sku.trim();
  if (!trimmed) return true;
  return PENDING_SKU.test(trimmed) || LEGACY_DRAFT_SKU.test(trimmed);
}

/** Unique local identity when form SKU is blank and sku-api is configured. */
export function createPendingCommerceSku(createToken: (prefix: string) => string): string {
  return createToken("pending").toUpperCase();
}
