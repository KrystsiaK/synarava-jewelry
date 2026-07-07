"use server";

import { revalidatePath } from "next/cache";

import { clearActiveCart, getOrCreateCart } from "@/lib/commerce/cart";
import {
  clearCheckoutOrderCookie,
  clearConfirmedOrderCookie,
} from "@/lib/commerce/checkout";

// Payment status is set exclusively by the Stripe webhook (checkout.session.completed).
// This action only cleans up the cart and session cookies.
export async function finalizeConfirmedCheckoutAction(_orderId?: string | null) {
  const cart = await getOrCreateCart({ createIfMissing: false });
  if (cart) {
    await clearActiveCart(cart.id);
  }

  await clearCheckoutOrderCookie();
  await clearConfirmedOrderCookie();
  revalidatePath("/cart");
  revalidatePath("/checkout/payment");
  revalidatePath("/checkout/confirmed");
}
