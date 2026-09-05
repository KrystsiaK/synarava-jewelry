import { redirect } from "next/navigation";

import {
  getStorefrontCheckoutUrl,
  usesShopifyCart,
} from "@/lib/commerce/storefront-cart";
import { getRequestLocale } from "@/lib/i18n/server";
import { localePath } from "@/lib/i18n/routing";

export default async function CheckoutPage() {
  const locale = await getRequestLocale();

  if (usesShopifyCart()) {
    const checkoutUrl = await getStorefrontCheckoutUrl();
    redirect(checkoutUrl ?? localePath(locale, "/cart"));
  }

  redirect(localePath(locale, "/checkout/shipping"));
}
