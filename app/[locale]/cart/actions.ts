"use server";

import { redirect } from "next/navigation";

import {
  addStorefrontProductToCart,
  getStorefrontCartViewModel,
  removeStorefrontCartItem,
  updateStorefrontCartItemQuantity,
} from "@/lib/commerce/storefront-cart";
import { revalidateStorefrontPath } from "@/lib/content/revalidate-storefront";
import { getRequestLocale } from "@/lib/i18n/server";
import { localePath } from "@/lib/i18n/routing";
import { safeRedirectPath } from "@/lib/security/safe-redirect";

const MAX_LINE_QUANTITY = 10;

function refreshCommerce() {
  revalidateStorefrontPath("/cart");
  revalidateStorefrontPath("/shop");
}

export async function addToCartAction(formData: FormData) {
  const productSlug = String(formData.get("productSlug") ?? "").trim();
  const requestedRedirect = String(formData.get("redirectTo") ?? "").trim();

  if (!productSlug) {
    return;
  }

  await addStorefrontProductToCart(productSlug, 1);
  refreshCommerce();

  const locale = await getRequestLocale();
  redirect(safeRedirectPath(requestedRedirect, localePath(locale, "/cart")));
}

// The line's current quantity is read back from the cart rather than trusted
// from the submitted form field, so a stale or tampered client value can
// only ever move the real server-side quantity by one step, never set it
// to an arbitrary number.
async function currentLineQuantity(itemId: string): Promise<number | null> {
  const cart = await getStorefrontCartViewModel();
  return cart.items.find((item) => item.id === itemId)?.quantity ?? null;
}

export async function increaseCartItemAction(formData: FormData) {
  const itemId = String(formData.get("itemId") ?? "").trim();
  if (!itemId) return;

  const quantity = await currentLineQuantity(itemId);
  if (quantity === null || quantity >= MAX_LINE_QUANTITY) return;

  await updateStorefrontCartItemQuantity(itemId, quantity + 1);
  refreshCommerce();
}

export async function decreaseCartItemAction(formData: FormData) {
  const itemId = String(formData.get("itemId") ?? "").trim();
  if (!itemId) return;

  const quantity = await currentLineQuantity(itemId);
  if (quantity === null || quantity < 1) return;

  await updateStorefrontCartItemQuantity(itemId, quantity - 1);
  refreshCommerce();
}

export async function removeCartItemAction(formData: FormData) {
  const itemId = String(formData.get("itemId") ?? "").trim();
  if (!itemId) return;
  await removeStorefrontCartItem(itemId);
  refreshCommerce();
}
