import "server-only";

import { shopifyStorefrontRequest } from "@/lib/shopify/storefront";

/**
 * Shopify's own related-product ranking (tags, product type, collection,
 * vendor) — works without any merchant configuration, unlike the
 * COMPLEMENTARY intent which needs curated pairings in Search & Discovery.
 */
export async function getShopifyRelatedProductIds(productId: string): Promise<string[]> {
  const data = await shopifyStorefrontRequest<{
    productRecommendations: Array<{ id: string }> | null;
  }>(
    `query SynaravaRelatedProducts($productId: ID!) {
      productRecommendations(productId: $productId, intent: RELATED) {
        id
      }
    }`,
    { productId },
  );
  return data.productRecommendations?.map((product) => product.id) ?? [];
}
