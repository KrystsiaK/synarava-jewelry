"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import {
  addStorefrontProductToCart,
  getStorefrontCartLineQuantity,
  removeStorefrontCartItem,
  updateStorefrontCartItemQuantity,
} from "@/lib/commerce/storefront-cart";
import { revalidateStorefrontPath } from "@/lib/content/revalidate-storefront";
import { parseFormData } from "@/lib/forms/parse-form-data";
import { getRequestLocale } from "@/lib/i18n/server";
import { localePath } from "@/lib/i18n/routing";
import { safeRedirectPath } from "@/lib/security/safe-redirect";

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
// to an arbitrary number. This still leaves a window between the read and
// the write — two tabs incrementing at once can lose one of the two steps —
// but CartItemRow disables its buttons while a request is in flight, and
// refreshCommerce() always brings the row back to Shopify's authoritative
// count afterward rather than trusting an optimistic local bump.
async function currentLineQuantity(itemId: string): Promise<number | null> {
  return getStorefrontCartLineQuantity(itemId);
}

export type CartItemActionState = { ok: boolean; error?: string };

export async function increaseCartItemAction(
  _prevState: CartItemActionState,
  formData: FormData,
): Promise<CartItemActionState> {
  const parsed = parseFormData(formData, cartItemSchema);
  if (!parsed.success) return { ok: false, error: "This item is no longer in your cart." };

  // No arbitrary line cap here (REV-10) — Shopify's own stock/inventoryPolicy is
  // the one limit, already what disables the "+" button (cart-item-row.tsx) and
  // what a cartLinesUpdate warning reports if it caps the actual increase.
  const quantity = await currentLineQuantity(parsed.data.itemId);
  if (quantity === null) return { ok: false, error: "This item is no longer in your cart." };

  try {
    await updateStorefrontCartItemQuantity(parsed.data.itemId, quantity + 1);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Couldn't update this item." };
  }
  refreshCommerce();
  return { ok: true };
}

export async function decreaseCartItemAction(
  _prevState: CartItemActionState,
  formData: FormData,
): Promise<CartItemActionState> {
  const parsed = parseFormData(formData, cartItemSchema);
  if (!parsed.success) return { ok: false, error: "This item is no longer in your cart." };

  const quantity = await currentLineQuantity(parsed.data.itemId);
  if (quantity === null || quantity < 1) return { ok: false, error: "This item is no longer in your cart." };

  try {
    await updateStorefrontCartItemQuantity(parsed.data.itemId, quantity - 1);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Couldn't update this item." };
  }
  refreshCommerce();
  return { ok: true };
}

export async function removeCartItemAction(
  _prevState: CartItemActionState,
  formData: FormData,
): Promise<CartItemActionState> {
  const parsed = parseFormData(formData, cartItemSchema);
  if (!parsed.success) return { ok: false, error: "This item is no longer in your cart." };

  try {
    await removeStorefrontCartItem(parsed.data.itemId);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Couldn't remove this item." };
  }
  refreshCommerce();
  return { ok: true };
}
