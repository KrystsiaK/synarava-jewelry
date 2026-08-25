"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  clearCheckoutOrderCookie,
  confirmCheckoutOrder,
  createOrUpdateDraftOrderFromCart,
  setConfirmedOrderCookie,
} from "@/lib/commerce/checkout";

export type ShippingField =
  | "email"
  | "name"
  | "line1"
  | "city"
  | "postalCode"
  | "countryCode";

export type ShippingActionState = {
  fieldErrors?: Partial<Record<ShippingField, string>>;
  formError?: string;
};

export async function submitShippingAction(
  _previousState: ShippingActionState,
  formData: FormData,
): Promise<ShippingActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const line1 = String(formData.get("line1") ?? "").trim();
  const line2 = String(formData.get("line2") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const region = String(formData.get("region") ?? "").trim();
  const postalCode = String(formData.get("postalCode") ?? "").trim();
  const countryCode = String(formData.get("countryCode") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  const fieldErrors: ShippingActionState["fieldErrors"] = {};
  if (!email) fieldErrors.email = "Enter the email address for delivery updates.";
  else if (!/^\S+@\S+\.\S+$/.test(email)) fieldErrors.email = "Enter a valid email address.";
  if (!name) fieldErrors.name = "Enter the recipient’s full name.";
  if (!line1) fieldErrors.line1 = "Enter the delivery address.";
  if (!city) fieldErrors.city = "Enter the delivery city.";
  if (!postalCode) fieldErrors.postalCode = "Enter the postal code.";
  if (!countryCode) fieldErrors.countryCode = "Choose the delivery country.";

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors };
  }

  let orderId: string | null;
  try {
    orderId = await createOrUpdateDraftOrderFromCart({
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
  } catch {
    return {
      formError: "Delivery details could not be saved. Check your connection and try again.",
    };
  }

  if (!orderId) {
    return {
      formError: "Your cart is no longer available. Return to the cart before continuing.",
    };
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
