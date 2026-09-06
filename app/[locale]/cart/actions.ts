"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import {
  addStorefrontProductToCart,
  getStorefrontCartViewModel,
  removeStorefrontCartItem,
  updateStorefrontCartItemQuantity,
} from "@/lib/commerce/storefront-cart";
import { revalidateStorefrontPath } from "@/lib/content/revalidate-storefront";
import { parseFormData } from "@/lib/forms/parse-form-data";
import { getRequestLocale } from "@/lib/i18n/server";
import { localePath } from "@/lib/i18n/routing";
import { safeRedirectPath } from "@/lib/security/safe-redirect";

const MAX_LINE_QUANTITY = 10;

const addToCartSchema = z.object({
  productSlug: z.string().trim().min(1),
  redirectTo: z.string().trim().default(""),
});

const cartItemSchema = z.object({
  itemId: z.string().trim().min(1),
});

function refreshCommerce() {
  revalidateStorefrontPath("/cart");
  revalidateStorefrontPath("/shop");
}

export async function addToCartAction(formData: FormData) {
  const parsed = parseFormData(formData, addToCartSchema);
  if (!parsed.success) return;
  const { productSlug, redirectTo } = parsed.data;

  await addStorefrontProductToCart(productSlug, 1);
  refreshCommerce();

  const locale = await getRequestLocale();
  redirect(safeRedirectPath(redirectTo, localePath(locale, "/cart")));
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
  const parsed = parseFormData(formData, cartItemSchema);
  if (!parsed.success) return;

  const quantity = await currentLineQuantity(parsed.data.itemId);
  if (quantity === null || quantity >= MAX_LINE_QUANTITY) return;

  await updateStorefrontCartItemQuantity(parsed.data.itemId, quantity + 1);
  refreshCommerce();
}

export async function decreaseCartItemAction(formData: FormData) {
  const parsed = parseFormData(formData, cartItemSchema);
  if (!parsed.success) return;

  const quantity = await currentLineQuantity(parsed.data.itemId);
  if (quantity === null || quantity < 1) return;

  await updateStorefrontCartItemQuantity(parsed.data.itemId, quantity - 1);
  refreshCommerce();
}

export async function removeCartItemAction(formData: FormData) {
  const parsed = parseFormData(formData, cartItemSchema);
  if (!parsed.success) return;

  await removeStorefrontCartItem(parsed.data.itemId);
  refreshCommerce();
}
