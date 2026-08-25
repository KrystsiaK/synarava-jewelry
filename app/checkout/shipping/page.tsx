import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { CartSummaryPanel } from "@/components/commerce/cart-summary-panel";
import { CheckoutShell } from "@/components/commerce/checkout-shell";
import { ShippingForm } from "@/components/commerce/shipping-form";
import { getCurrentUser } from "@/lib/auth/session";
import { getCartViewModel } from "@/lib/commerce/cart";
import { getServerTranslations } from "@/lib/i18n/server";

export const metadata: Metadata = {
  title: "Shipping | Synarava",
  description: "Enter shipping details for the current acquisition.",
};

export default async function ShippingPage() {
  const [cart, { t }] = await Promise.all([getCartViewModel(), getServerTranslations()]);

  if (cart.itemCount === 0) redirect("/cart");

  const user = await getCurrentUser();

  return (
    <CheckoutShell
      eyebrow={t("checkout.shipping.eyebrow")}
      title={t("checkout.shipping.title")}
      description={t("checkout.shipping.description")}
      step="shipping"
      aside={
        <div className="space-y-6">
          <CartSummaryPanel
            itemCount={cart.itemCount}
            subtotal={cart.subtotal}
            note={t("checkout.shipping.accountNote")}
          />

          {!user ? (
            <section className="panel p-6">
              <p className="label-caps text-accent">{t("checkout.shipping.accountOptions")}</p>
              <p className="mt-4 text-sm leading-6 text-foreground/65">
                {t("checkout.shipping.accountBody")}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/login?redirectTo=/checkout/shipping"
                  className="border border-stroke px-4 py-3 label-caps transition-colors hover:border-accent hover:text-accent"
                >
                  {t("checkout.shipping.login")}
                </Link>
                <Link
                  href="/register"
                  className="border border-stroke px-4 py-3 label-caps transition-colors hover:border-accent hover:text-accent"
                >
                  {t("checkout.shipping.register")}
                </Link>
              </div>
            </section>
          ) : (
            <section className="panel p-6">
              <p className="label-caps text-accent">{t("checkout.shipping.signedIn")}</p>
              <p className="mt-4 text-sm leading-6 text-foreground/65">
                {t("checkout.shipping.linkedTo", { email: user.email })}
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
