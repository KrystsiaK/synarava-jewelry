import "server-only";

import { ShopifyAdminError, shopifyAdminRequest } from "@/lib/shopify/admin";

type UserError = { field?: string[] | null; message: string };

function throwOnUserErrors(errors: UserError[]) {
  if (errors.length === 0) return;
  throw new ShopifyAdminError(errors.map((error) => error.message).join("; "));
}

/**
 * Write Variant SKU via productVariantsBulkUpdate and require inventoryItem.sku read-back.
 * Same mutation shape as commerce-field-apply Variant SKU writer (ADR-0002/0004).
 */
export async function writeShopifyVariantSku(input: {
  readonly shopifyProductId: string;
  readonly shopifyVariantId: string;
  readonly sku: string;
}): Promise<
  | { readonly ok: true; readonly readBackSku: string }
  | { readonly ok: false; readonly error: string }
> {
  try {
    const result = await shopifyAdminRequest<{
      productVariantsBulkUpdate: {
        productVariants: Array<{
          id: string;
          inventoryItem: { sku: string | null };
        }>;
        userErrors: UserError[];
      };
    }>(
      `mutation SynaravaSkuAssignVariantUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
        productVariantsBulkUpdate(productId: $productId, variants: $variants) {
          productVariants { id inventoryItem { sku } }
          userErrors { field message }
        }
      }`,
      {
        productId: input.shopifyProductId,
        variants: [{ id: input.shopifyVariantId, inventoryItem: { sku: input.sku } }],
      },
    );
    throwOnUserErrors(result.productVariantsBulkUpdate.userErrors);
    const saved = result.productVariantsBulkUpdate.productVariants[0];
    const readBackSku = saved?.inventoryItem.sku ?? "";
    if (!saved || readBackSku !== input.sku) {
      return {
        ok: false,
        error: "Shopify accepted the SKU write but read-back did not match. Reservation left pending for recovery.",
      };
    }
    return { ok: true, readBackSku };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Shopify SKU write failed",
    };
  }
}
