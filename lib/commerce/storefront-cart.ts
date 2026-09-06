import "server-only";

import { db } from "@/lib/db";
import {
  addShopifyProductToCart,
  getShopifyCartCount,
  getShopifyCartViewModel,
  getShopifyCheckoutUrl,
  removeShopifyCartItem,
  updateShopifyCartItemQuantity,
} from "@/lib/shopify/cart";

export async function getStorefrontCartViewModel() {
  return getShopifyCartViewModel();
}

export async function getStorefrontCartCount() {
  return getShopifyCartCount();
}

export async function addStorefrontProductToCart(
  productSlug: string,
  quantity = 1,
  merchandiseId?: string,
) {
  if (merchandiseId) {
    const product = await db.product.findFirst({
      where: {
        slug: productSlug,
        status: "ACTIVE",
        visibility: "PUBLIC",
        variants: {
          some: { shopifyVariantId: merchandiseId, status: "ACTIVE" },
        },
      },
      select: { shopifyHandle: true },
    });
    if (!product) throw new Error("Product not available.");
    return addShopifyProductToCart(product.shopifyHandle || productSlug, quantity, merchandiseId);
  }

  const product = await db.product.findUnique({
    where: { slug: productSlug },
    select: {
      shopifyHandle: true,
      variants: {
        where: {
          shopifyVariantId: { not: null },
          status: "ACTIVE",
        },
        orderBy: [
          { stockOnHand: "desc" },
          { createdAt: "asc" },
        ],
        take: 1,
        select: { shopifyVariantId: true },
      },
    },
  });

  return addShopifyProductToCart(
    product?.shopifyHandle || productSlug,
    quantity,
    product?.variants[0]?.shopifyVariantId ?? undefined,
  );
}

export async function updateStorefrontCartItemQuantity(itemId: string, quantity: number) {
  return updateShopifyCartItemQuantity(itemId, quantity);
}

export async function removeStorefrontCartItem(itemId: string) {
  return removeShopifyCartItem(itemId);
}

export async function getStorefrontCheckoutUrl() {
  return getShopifyCheckoutUrl();
}
