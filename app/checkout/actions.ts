"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  clearCheckoutOrderCookie,
  confirmCheckoutOrder,
  createOrUpdateDraftOrderFromCart,
  setConfirmedOrderCookie,
} from "@/lib/commerce/checkout";

export async function submitShippingAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const line1 = String(formData.get("line1") ?? "").trim();
  const line2 = String(formData.get("line2") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const region = String(formData.get("region") ?? "").trim();
  const postalCode = String(formData.get("postalCode") ?? "").trim();
  const countryCode = String(formData.get("countryCode") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!email || !name || !line1 || !city || !postalCode || !countryCode) {
    redirect("/checkout/error?reason=shipping");
  }

  const orderId = await createOrUpdateDraftOrderFromCart({
    email,
    name,
    line1,
    line2,
    city,
    region,
    postalCode,
    countryCode,
    notes,
  });

  if (!orderId) {
    redirect("/checkout/error?reason=cart");
  }

  revalidatePath("/checkout/shipping");
  revalidatePath("/checkout/payment");
  redirect("/checkout/payment");
}

export async function confirmOrderAction() {
  const orderId = await confirmCheckoutOrder();

  if (!orderId) {
    redirect("/checkout/error?reason=payment");
  }

  await setConfirmedOrderCookie(orderId);
  await clearCheckoutOrderCookie();
  revalidatePath("/cart");
  revalidatePath("/checkout/payment");
  revalidatePath("/checkout/confirmed");
  redirect(`/checkout/confirmed?order=${orderId}`);
}

export async function resetCheckoutAction() {
  await clearCheckoutOrderCookie();
  redirect("/cart");
}
