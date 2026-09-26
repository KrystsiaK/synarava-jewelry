import "server-only";

import { db } from "@/lib/db";
import {
  emptyCommerceStore,
  productStoreKey,
  setProductWindow,
  type CommerceStore,
} from "@/lib/commerce-store/types";
import { writeThroughLocalCommerceToProjection } from "@/lib/shopify/shopify-projection-diff";

/**
 * Build full OUR store snapshot from DB (commerce windows only).
 * Prefer workingSnapshot; else seed window from columns + shopifySnapshot base.
 */
export async function buildOurCommerceStore(): Promise<CommerceStore> {
  const products = await db.product.findMany({
    select: {
      id: true,
      shopifyProductId: true,
      workingSnapshot: true,
      shopifySnapshot: true,
      name: true,
      slug: true,
      vendor: true,
      productType: true,
      priceCents: true,
      variants: {
        orderBy: { createdAt: "asc" },
        take: 1,
        select: {
          shopifyVariantId: true,
          sku: true,
          priceCents: true,
          taxable: true,
          stockOnHand: true,
        },
      },
    },
    orderBy: { id: "asc" },
  });

  let store = emptyCommerceStore();
  for (const product of products) {
    const key = productStoreKey({
      shopifyProductId: product.shopifyProductId,
      localProductId: product.id,
    });
    const variant = product.variants[0];
    const window = product.workingSnapshot
      ?? writeThroughLocalCommerceToProjection(product.shopifySnapshot ?? {}, {
        title: product.name,
        handle: product.slug,
        vendor: product.vendor,
        productType: product.productType,
        variant: variant
          ? {
              shopifyVariantId: variant.shopifyVariantId,
              sku: variant.sku,
              priceCents: variant.priceCents,
              taxable: variant.taxable,
              inventoryQuantity: variant.stockOnHand,
            }
          : { priceCents: product.priceCents },
      });
    store = setProductWindow(store, key, window);
  }
  return store;
}
