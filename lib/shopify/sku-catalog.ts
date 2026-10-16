import "server-only";

import {
  CATALOG_AUDIT_MAX_BATCH,
  shopifyCatalogSnapshotResponseSchema,
  type ShopifyCatalogSnapshotResponse,
} from "@synarava/sku-contract";

import { shopifyAdminRequest } from "@/lib/shopify/admin";

const SHOPIFY_PAGE_SIZE = 250;

type ShopifyVariantPage = {
  productVariants: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    nodes: Array<{ id: string; sku: string | null }>;
  };
};

/** Read the complete live Shopify variant/SKU catalog with deterministic order. */
export async function fetchShopifySkuCatalog(): Promise<ShopifyCatalogSnapshotResponse> {
  const items: Array<{ externalVariantId: string; sku: string }> = [];
  let cursor: string | null = null;

  do {
    const data: ShopifyVariantPage = await shopifyAdminRequest(
      `query SynaravaSkuCatalog($after: String) {
        productVariants(first: ${SHOPIFY_PAGE_SIZE}, after: $after, sortKey: ID) {
          pageInfo { hasNextPage endCursor }
          nodes { id sku }
        }
      }`,
      { after: cursor },
    );

    for (const variant of data.productVariants.nodes) {
      items.push({
        externalVariantId: variant.id,
        sku: variant.sku?.trim() ?? "",
      });
      if (items.length > CATALOG_AUDIT_MAX_BATCH) {
        throw new Error(
          `Shopify catalog exceeds the audit safety limit of ${CATALOG_AUDIT_MAX_BATCH} variants.`,
        );
      }
    }

    const pageInfo = data.productVariants.pageInfo;
    if (pageInfo.hasNextPage && !pageInfo.endCursor) {
      throw new Error("Shopify catalog pagination returned no end cursor.");
    }
    cursor = pageInfo.hasNextPage ? pageInfo.endCursor : null;
  } while (cursor);

  items.sort((left, right) => left.externalVariantId.localeCompare(right.externalVariantId));
  return shopifyCatalogSnapshotResponseSchema.parse({
    ok: true,
    source: "shopify",
    complete: true,
    itemCount: items.length,
    items,
  });
}
