import { redirect } from "next/navigation";

import {
  getStorefrontCheckoutUrl,
  usesShopifyCart,
} from "@/lib/commerce/storefront-cart";

export default async function CheckoutPage() {
  if (usesShopifyCart()) {
    const checkoutUrl = await getStorefrontCheckoutUrl();
    redirect(checkoutUrl ?? "/cart");
  }

  redirect("/checkout/shipping");
}
