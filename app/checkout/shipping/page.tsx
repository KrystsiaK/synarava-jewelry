import type { Metadata } from "next";
import Link from "next/link";

import { CartSummaryPanel } from "@/components/commerce/cart-summary-panel";
import { CheckoutShell } from "@/components/commerce/checkout-shell";
import { ShippingForm } from "@/components/commerce/shipping-form";
import { getCurrentUser } from "@/lib/auth/session";
import { getCartViewModel } from "@/lib/commerce/cart";

export const metadata: Metadata = {
  title: "Shipping | Synarava",
  description: "Enter shipping details for the current acquisition.",
};

export default async function ShippingPage() {
  const cart = await getCartViewModel();
  const user = await getCurrentUser();

  return (
    <CheckoutShell
      eyebrow="SYNARAVA | Acquisition Details (Shipping)"
      title="Where should the artifact travel next?"
      description="This step prepares the delivery record. You can keep going as a guest or sign in first if you want the order tied to an account."
      step="shipping"
      aside={
        <div className="space-y-6">
          <CartSummaryPanel
            itemCount={cart.itemCount}
            subtotal={cart.subtotal}
            note="If you sign in or register now, the same cart is preserved and attached to your account."
          />

          {!user ? (
            <section className="panel p-6">
              <p className="label-caps text-accent">Account options</p>
              <p className="mt-4 text-sm leading-6 text-foreground/65">
                Continue as guest now, or connect the order to an account for easier history and
                later admin support.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/login?redirectTo=/checkout/shipping"
                  className="border border-stroke px-4 py-3 label-caps transition-colors hover:border-accent hover:text-accent"
                >
                  Login
                </Link>
                <Link
                  href="/register"
                  className="border border-stroke px-4 py-3 label-caps transition-colors hover:border-accent hover:text-accent"
                >
                  Register
                </Link>
              </div>
            </section>
          ) : (
            <section className="panel p-6">
              <p className="label-caps text-accent">Signed in</p>
              <p className="mt-4 text-sm leading-6 text-foreground/65">
                This order will be linked to <strong>{user.email}</strong>.
              </p>
            </section>
          )}
        </div>
      }
    >
      <ShippingForm defaultEmail={user?.email} defaultName={user?.name} />
    </CheckoutShell>
  );
}
