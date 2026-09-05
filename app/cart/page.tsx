import type { Metadata } from "next";

import {
  getStorefrontCartViewModel,
  usesShopifyCart,
} from "@/lib/commerce/storefront-cart";
import { CartShell } from "@/components/commerce/cart-shell";

export const metadata: Metadata = {
  title: "Cart | Synarava",
  description: "Review selected Synarava pieces before continuing to acquisition.",
};

export default async function CartPage() {
  const cart = await getStorefrontCartViewModel();

  return (
    <CartShell
      items={cart.items}
      itemCount={cart.itemCount}
      subtotalCents={cart.subtotalCents}
      subtotal={cart.subtotal}
      currency={cart.currency}
      usesShopifyCheckout={usesShopifyCart()}
    />
  );
}
