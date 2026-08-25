"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  clearCheckoutOrderCookie,
  confirmCheckoutOrder,
  createOrUpdateDraftOrderFromCart,
  setConfirmedOrderCookie,
} from "@/lib/commerce/checkout";
import { getServerTranslations } from "@/lib/i18n/server";

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
  const { t } = await getServerTranslations();
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
  if (!email) fieldErrors.email = t("checkout.validation.emailRequired");
  else if (!/^\S+@\S+\.\S+$/.test(email)) fieldErrors.email = t("checkout.validation.emailInvalid");
  if (!name) fieldErrors.name = t("checkout.validation.name");
  if (!line1) fieldErrors.line1 = t("checkout.validation.address");
  if (!city) fieldErrors.city = t("checkout.validation.city");
  if (!postalCode) fieldErrors.postalCode = t("checkout.validation.postalCode");
  if (!countryCode) fieldErrors.countryCode = t("checkout.validation.country");

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
      formError: t("checkout.validation.save"),
    };
  }

  if (!orderId) {
    return {
      formError: t("checkout.validation.cart"),
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
