"use server";

import { revalidatePath } from "next/cache";

import { clearActiveCart, getOrCreateCart } from "@/lib/commerce/cart";
import {
  clearCheckoutOrderCookie,
  clearConfirmedOrderCookie,
  getCheckoutOrderIdFromCookie,
} from "@/lib/commerce/checkout";
import { db } from "@/lib/db";

export async function finalizeConfirmedCheckoutAction(orderId?: string | null) {
  const resolvedOrderId = orderId?.trim() || (await getCheckoutOrderIdFromCookie());

  if (resolvedOrderId) {
    await db.order.updateMany({
      where: {
        id: resolvedOrderId,
        status: "DRAFT",
      },
      data: {
        status: "PENDING",
        paymentStatus: "AUTHORIZED",
        fulfillmentStatus: "UNFULFILLED",
      },
    });
  }

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
