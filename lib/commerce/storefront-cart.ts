import "server-only";

// Thin re-export over lib/shopify/cart, named for what pages/actions do
// ("the storefront cart") rather than how it's implemented. Shopify is the
// only commerce backend — this isn't a seam for a hypothetical alternate
// one, just a naming boundary between storefront code and Shopify-specific
// code.
import { db } from "@/lib/db";
import {
  addShopifyProductToCart,
  getShopifyCartCount,
  getShopifyCartLineQuantity,
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

export async function getStorefrontCartLineQuantity(itemId: string) {
  return getShopifyCartLineQuantity(itemId);
}

export async function addStorefrontProductToCart(
  productSlug: string,
  quantity = 1,
  merchandiseId?: string,
) {
  // One visibility policy for every entry point (REV-08): the merchandiseId
  // branch used to check local status/visibility while the handle-only branch
  // didn't check anything, so a locally hidden/archived — or entirely local-only
  // — slug could still add a still-published Shopify product via that branch.
  const product = await db.product.findFirst({
    where: {
      slug: productSlug,
      OR: [
        { status: "ACTIVE", visibility: "PUBLIC" },
        { status: "UNLISTED", visibility: "UNLISTED" },
      ],
      ...(merchandiseId
        ? { variants: { some: { shopifyVariantId: merchandiseId, status: { in: ["ACTIVE", "UNLISTED"] } } } }
        : {}),
    },
    select: {
      shopifyHandle: true,
      variants: {
        where: { shopifyVariantId: { not: null }, status: { in: ["ACTIVE", "UNLISTED"] } },
        orderBy: [{ stockOnHand: "desc" }, { createdAt: "asc" }],
        take: 1,
        select: { shopifyVariantId: true },
      },
    },
  });
  if (!product) throw new Error("Product not available.");

  return addShopifyProductToCart(
    product.shopifyHandle || productSlug,
    quantity,
    merchandiseId ?? product.variants[0]?.shopifyVariantId ?? undefined,
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
