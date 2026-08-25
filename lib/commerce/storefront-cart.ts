import "server-only";

import * as localCart from "@/lib/commerce/cart";
import { db } from "@/lib/db";
import { isShopifyCommerceEnabled } from "@/lib/shopify/config";
import {
  addShopifyProductToCart,
  getShopifyCartCount,
  getShopifyCartViewModel,
  getShopifyCheckoutUrl,
  removeShopifyCartItem,
  updateShopifyCartItemQuantity,
} from "@/lib/shopify/cart";

export function usesShopifyCart() {
  return isShopifyCommerceEnabled();
}

export async function getStorefrontCartViewModel() {
  return isShopifyCommerceEnabled()
    ? getShopifyCartViewModel()
    : localCart.getCartViewModel();
}

export async function getStorefrontCartCount() {
  return isShopifyCommerceEnabled()
    ? getShopifyCartCount()
    : localCart.getCartCount();
}

export async function addStorefrontProductToCart(
  productSlug: string,
  quantity = 1,
  merchandiseId?: string,
) {
  if (isShopifyCommerceEnabled()) {
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
  return localCart.addProductToCart(productSlug, quantity);
}

export async function updateStorefrontCartItemQuantity(itemId: string, quantity: number) {
  return isShopifyCommerceEnabled()
    ? updateShopifyCartItemQuantity(itemId, quantity)
    : localCart.updateCartItemQuantity(itemId, quantity);
}

export async function removeStorefrontCartItem(itemId: string) {
  return isShopifyCommerceEnabled()
    ? removeShopifyCartItem(itemId)
    : localCart.removeCartItem(itemId);
}

export async function attachStorefrontCartToUser(userId: string) {
  if (!isShopifyCommerceEnabled()) {
    await localCart.attachCurrentCartToUser(userId);
  }
}

export async function getStorefrontCheckoutUrl() {
  return isShopifyCommerceEnabled() ? getShopifyCheckoutUrl() : null;
}
