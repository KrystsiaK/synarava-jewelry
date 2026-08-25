import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CartSummaryPanel } from "@/components/commerce/cart-summary-panel";
import { CheckoutShell } from "@/components/commerce/checkout-shell";
import { PaymentConfirmPanel } from "@/components/commerce/payment-confirm-panel";
import { createOrGetStripeCheckoutSession, getCheckoutOrder } from "@/lib/commerce/checkout";
import { formatCurrency } from "@/lib/i18n/format";
import { getServerTranslations } from "@/lib/i18n/server";

export const metadata: Metadata = {
  title: "Payment | Synarava",
  description: "Review and confirm the current acquisition.",
};

export default async function PaymentPage() {
  const [order, translations] = await Promise.all([getCheckoutOrder(), getServerTranslations()]);
  const { locale, t } = translations;

  if (!order || order.status !== "DRAFT") {
    redirect("/checkout/error?reason=payment");
  }

  const clientSecret = await createOrGetStripeCheckoutSession();

  if (!clientSecret) {
    redirect("/checkout/error?reason=stripe");
  }

  const total = formatCurrency(order.totalCents / 100, order.currency, locale);

  return (
    <CheckoutShell
      eyebrow={t("checkout.paymentPage.eyebrow")}
      title={t("checkout.paymentPage.title")}
      description={t("checkout.paymentPage.description")}
      step="payment"
      aside={
        <CartSummaryPanel
          itemCount={order.items.reduce((sum, item) => sum + item.quantity, 0)}
          subtotal={total}
        />
      }
    >
      <PaymentConfirmPanel order={order} clientSecret={clientSecret} />
    </CheckoutShell>
  );
}
