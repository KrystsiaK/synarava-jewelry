import "server-only";

import { shopifyAdminRequest } from "@/lib/shopify/admin";

/**
 * Read-back Variant SKU from Shopify without mutation (Éтап 4 recovery / idempotent confirm).
 */
export async function readShopifyVariantSku(input: {
  readonly shopifyProductId: string;
  readonly shopifyVariantId: string;
}): Promise<
  | { readonly ok: true; readonly sku: string }
  | { readonly ok: false; readonly error: string }
> {
  try {
    const result = await shopifyAdminRequest<{
      product: {
        variants: {
          nodes: Array<{ id: string; inventoryItem: { sku: string | null } | null }>;
        };
      } | null;
    }>(
      `query SynaravaSkuReadVariant($id: ID!) {
        product(id: $id) {
          variants(first: 100) {
            nodes { id inventoryItem { sku } }
          }
        }
      }`,
      { id: input.shopifyProductId },
    );
    const node = result.product?.variants.nodes.find((variant) => variant.id === input.shopifyVariantId);
    if (!node) {
      return { ok: false, error: "Shopify variant not found for SKU read-back" };
    }
    return { ok: true, sku: node.inventoryItem?.sku ?? "" };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Shopify SKU read failed",
    };
  }
}
