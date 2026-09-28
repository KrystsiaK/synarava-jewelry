import "server-only";

import { db } from "@/lib/db";
import { hasShopifyAdminConfig } from "@/lib/shopify/admin";
import {
  getShopifyCustomerProductReviews,
  getShopifyProductReviews,
  type ShopifyCustomerReview,
} from "@/lib/shopify/product-reviews";

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

export async function getCustomerProductReviews(customerId: string): Promise<ShopifyCustomerReview[]> {
  if (!hasShopifyAdminConfig()) return [];
  try {
    return await getShopifyCustomerProductReviews(customerId);
  } catch (error) {
    console.error(
      "[shopify-product-reviews] Customer reviews unavailable:",
      error instanceof Error ? error.message : "Unknown Shopify error",
    );
    return [];
  }
}

export async function listReviewProductLinks(shopifyProductIds: string[], locale: string) {
  if (shopifyProductIds.length === 0) return [];
  const products = await db.product.findMany({
    where: { shopifyProductId: { in: shopifyProductIds } },
    select: {
      shopifyProductId: true,
      slug: true,
      name: true,
      translations: {
        where: { locale },
        select: { title: true, reviewStatus: true },
      },
    },
  });
  return products.flatMap((product) => {
    if (!product.shopifyProductId) return [];
    const reviewed = product.translations.find((row) => row.reviewStatus === "REVIEWED" && row.title.trim());
    return [{
      shopifyProductId: product.shopifyProductId,
      slug: product.slug,
      title: reviewed?.title ?? product.name,
    }];
  });
}
