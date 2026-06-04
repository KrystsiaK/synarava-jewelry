import type { Metadata } from "next";

import { getCartViewModel } from "@/lib/commerce/cart";
import { CartShell } from "@/components/commerce/cart-shell";

export const metadata: Metadata = {
  title: "Cart | Synarava",
  description: "Review selected Synarava pieces before continuing to acquisition.",
};

export default async function CartPage() {
  const cart = await getCartViewModel();

  return (
    <CartShell
      items={cart.items}
      itemCount={cart.itemCount}
      subtotal={cart.subtotal}
    />
  );
}