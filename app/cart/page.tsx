import type { Metadata } from "next";
import Link from "next/link";

import { CartItemRow } from "@/components/commerce/cart-item-row";
import { CartSummaryPanel } from "@/components/commerce/cart-summary-panel";
import { getCartViewModel } from "@/lib/commerce/cart";

export const metadata: Metadata = {
  title: "Cart | Synarava",
  description: "Review selected Synarava pieces before continuing to acquisition.",
};

export default async function CartPage() {
  const cart = await getCartViewModel();

  return (
    <main className="artifact-shell min-h-screen pt-28">
      <div className="site-shell grid gap-8 py-16 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="space-y-8">
          <header className="space-y-4">
            <p className="label-caps text-accent">Selection</p>
            <h1 className="font-serif text-[3.2rem] leading-[0.94] md:text-[4.6rem]">
              A cart that stays with the visitor.
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-foreground/70">
              Guests can continue to shipping without registering, and signed-in users keep the
              same cart after login.
            </p>
          </header>

          <div className="panel p-6 md:p-8">
            {cart.items.length === 0 ? (
              <div className="space-y-4">
                <h2 className="font-serif text-[2rem]">The cart is empty.</h2>
                <p className="max-w-xl text-base leading-8 text-foreground/65">
                  Start from the product pages or the shop archive. Once a piece is added, it stays
                  available for guest checkout or account-based checkout.
                </p>
                <Link
                  href="/shop"
                  className="inline-flex items-center justify-center bg-charcoal px-6 py-4 label-caps text-white transition-colors hover:bg-couture-red"
                >
                  Browse shop
                </Link>
              </div>
            ) : (
              <div>
                {cart.items.map((item) => (
                  <CartItemRow key={item.id} item={item} />
                ))}
              </div>
            )}
          </div>
        </section>

        <CartSummaryPanel
          itemCount={cart.itemCount}
          subtotal={cart.subtotal}
          ctaHref={cart.items.length > 0 ? "/checkout/shipping" : undefined}
          ctaLabel={cart.items.length > 0 ? "Continue to shipping" : undefined}
          note="Shipping details come first. At checkout you can either sign in or continue as guest."
        />
      </div>
    </main>
  );
}
