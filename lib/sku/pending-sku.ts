/**
 * Local Product/Variant SKU placeholders used until sku-api reserve/confirm.
 * Never treat these as Shopify commerce SKUs when the SKU API is configured.
 */

const LEGACY_DRAFT_SKU = /^SKU-[a-z0-9]+-[a-z0-9]+$/i;
const PENDING_SKU = /^PENDING-[a-z0-9]+-[a-z0-9]+$/i;
/** Legacy pull invent for empty Shopify SKU — must stay assignable (M2). */
const SHOPIFY_INVENT_PLACEHOLDER = /^SHOPIFY-[a-z0-9]+(?:-[a-z0-9]+)*$/i;

function gidTail(gid: string): string {
  const tail = gid.split("/").pop()?.trim() ?? "";
  return tail.replace(/[^a-z0-9]/gi, "") || "0";
}

export function isPendingCommerceSku(sku: string): boolean {
  const trimmed = sku.trim();
  if (!trimmed) return true;
  return (
    PENDING_SKU.test(trimmed)
    || LEGACY_DRAFT_SKU.test(trimmed)
    || SHOPIFY_INVENT_PLACEHOLDER.test(trimmed)
  );
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
