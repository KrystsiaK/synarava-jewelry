import { redirect } from "next/navigation";

import { getStorefrontCheckoutUrl } from "@/lib/commerce/storefront-cart";
import { getRequestLocale } from "@/lib/i18n/server";
import { localePath } from "@/lib/i18n/routing";

export default async function CheckoutPage() {
  const [checkoutUrl, locale] = await Promise.all([
    getStorefrontCheckoutUrl(),
    getRequestLocale(),
  ]);

  redirect(checkoutUrl ?? localePath(locale, "/cart"));
}
