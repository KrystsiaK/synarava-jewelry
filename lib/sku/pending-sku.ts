/**
 * Local Product/Variant SKU placeholders used until sku-api reserve/confirm.
 * Never treat these as Shopify commerce SKUs when the SKU API is configured.
 */

/** Legacy autosave invent: SKU-{token}-{token} — not policy stems like JW-NECK-001. */
const LEGACY_DRAFT_SKU = /^SKU-[a-z0-9]+-[a-z0-9]+$/i;

function gidTail(gid: string): string {
  const tail = gid.split("/").pop()?.trim() ?? "";
  return tail.replace(/[^a-z0-9]/gi, "") || "0";
}

/**
 * True when the local SKU is a placeholder that still needs Family → Preview → Confirm.
 * Uses prefix checks (not fragile regex) so Pull invents like
 * `SHOPIFY-16079211397451-58824796668235` never lock the Inventory panel (M2).
 */
export function isPendingCommerceSku(sku: string): boolean {
  const trimmed = sku.trim();
  if (!trimmed) return true;
  const upper = trimmed.toUpperCase();
  if (upper.startsWith("SHOPIFY-")) return true;
  if (upper.startsWith("PENDING-")) return true;
  return LEGACY_DRAFT_SKU.test(trimmed);
}

/** Alias for UI — same predicate as {@link isPendingCommerceSku}. */
export function needsSkuAssignment(sku: string): boolean {
  return isPendingCommerceSku(sku);
}

/** Unique local identity when form SKU is blank and sku-api is configured. */
export function createPendingCommerceSku(createToken: (prefix: string) => string): string {
  return createToken("pending").toUpperCase();
}

/**
 * Local identity when Shopify Variant SKU is empty on Pull.
 * Uses PENDING-* (assignable) — never invent SHOPIFY-* as an "assigned" commerce SKU.
 */
export function localSkuForEmptyShopifySku(input: {
  readonly shopifyProductId: string;
  readonly shopifyVariantId?: string | null;
}): string {
  const productTail = gidTail(input.shopifyProductId);
  const variantTail = input.shopifyVariantId ? gidTail(input.shopifyVariantId) : "";
  if (variantTail) {
    return `PENDING-p${productTail}-v${variantTail}`;
  }
  return `PENDING-p${productTail}-sku`;
}

/** True for legacy Pull invent that must be rewritten / treated as unassigned. */
export function isShopifyInventPlaceholderSku(sku: string): boolean {
  return sku.trim().toUpperCase().startsWith("SHOPIFY-");
}
