"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  addStorefrontProductToCart,
  removeStorefrontCartItem,
  updateStorefrontCartItemQuantity,
} from "@/lib/commerce/storefront-cart";

function refreshCommerce() {
  revalidatePath("/cart");
  revalidatePath("/shop");
}

export async function addToCartAction(formData: FormData) {
  const productSlug = String(formData.get("productSlug") ?? "").trim();
  const redirectTo = String(formData.get("redirectTo") ?? "/cart").trim();

  if (!productSlug) {
    return;
  }

  await addStorefrontProductToCart(productSlug, 1);
  refreshCommerce();
  redirect(redirectTo || "/cart");
}

export async function increaseCartItemAction(formData: FormData) {
  const itemId = String(formData.get("itemId") ?? "").trim();
  const quantity = Number(formData.get("quantity") ?? 1);
  if (!itemId || !Number.isInteger(quantity) || quantity < 0 || quantity >= 10) return;
  await updateStorefrontCartItemQuantity(itemId, quantity + 1);
  refreshCommerce();
}

export async function decreaseCartItemAction(formData: FormData) {
  const itemId = String(formData.get("itemId") ?? "").trim();
  const quantity = Number(formData.get("quantity") ?? 1);
  if (!itemId || !Number.isInteger(quantity) || quantity < 1 || quantity > 10) return;
  await updateStorefrontCartItemQuantity(itemId, quantity - 1);
  refreshCommerce();
}

export async function removeCartItemAction(formData: FormData) {
  const itemId = String(formData.get("itemId") ?? "").trim();
  if (!itemId) return;
  await removeStorefrontCartItem(itemId);
  refreshCommerce();
}
