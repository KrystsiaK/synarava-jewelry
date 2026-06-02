import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CartSummaryPanel } from "@/components/commerce/cart-summary-panel";
import { CheckoutShell } from "@/components/commerce/checkout-shell";
import { PaymentConfirmPanel } from "@/components/commerce/payment-confirm-panel";
import { getCheckoutOrder } from "@/lib/commerce/checkout";

export const metadata: Metadata = {
  title: "Payment | Synarava",
  description: "Review and confirm the current acquisition.",
};

export default async function PaymentPage() {
  const order = await getCheckoutOrder();

  if (!order || order.status !== "DRAFT") {
    redirect("/checkout/error?reason=payment");
  }

  const total = new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: order.currency,
    minimumFractionDigits: 2,
  }).format(order.totalCents / 100);

  return (
    <CheckoutShell
      eyebrow="SYNARAVA | Secure Acquisition (Payment)"
      title="A final quiet checkpoint before confirmation."
      description="This is the secure acquisition layer: review the order, verify the shipping destination, and commit the record."
      step="payment"
      aside={
        <CartSummaryPanel
          itemCount={order.items.reduce((sum, item) => sum + item.quantity, 0)}
          subtotal={total}
          note="The current implementation confirms the order in local mode and is ready for the next Stripe wiring pass."
        />
      }
    >
      <PaymentConfirmPanel order={order} />
    </CheckoutShell>
  );
}
