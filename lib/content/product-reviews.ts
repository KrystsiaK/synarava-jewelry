import "server-only";

import { db } from "@/lib/db";
import { hasShopifyAdminConfig } from "@/lib/shopify/admin";
import { getShopifyProductReviews } from "@/lib/shopify/product-reviews";

export async function getProductReviewsBySlug(slug: string) {
  if (!hasShopifyAdminConfig()) return null;
  const product = await db.product.findUnique({
    where: { slug },
    select: { shopifyProductId: true },
  });
  if (!product?.shopifyProductId) return null;

  try {
    return await getShopifyProductReviews(product.shopifyProductId);
  } catch {
    // Review scopes are separately approved by Shopify. Commerce pages must
    // remain available while that approval or configuration is pending.
    return null;
  }
}
