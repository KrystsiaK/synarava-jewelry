import { headers } from "next/headers";
import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { db } from "@/lib/db";
import { getStripe, hasStripeSecretKey } from "@/lib/stripe";

export async function POST(req: Request) {
  const body = await req.text();
  const sig = (await headers()).get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!hasStripeSecretKey()) {
    return NextResponse.json({ error: "Stripe secret key not configured" }, { status: 500 });
  }

  if (!webhookSecret) {
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.orderId;

    if (orderId) {
      const order = await db.order.findUnique({
        where: { id: orderId },
        select: { totalCents: true, currency: true, paymentStatus: true },
      });

      if (!order) {
        console.error(`[webhook] Order not found: ${orderId}`);
        // Return 200 so Stripe does not retry an event we cannot process.
        return NextResponse.json({ received: true });
      }

      // Idempotency: skip if already marked PAID by a previous delivery of this event.
      if (order.paymentStatus === "PAID") {
        return NextResponse.json({ received: true });
      }

      // Verify the charged amount and currency match the order to detect tampering.
      const chargedCents = session.amount_total ?? 0;
      const chargedCurrency = (session.currency ?? "").toUpperCase();
      const expectedCurrency = order.currency.toUpperCase();

      if (chargedCents !== order.totalCents || chargedCurrency !== expectedCurrency) {
        console.error(
          `[webhook] Amount mismatch for order ${orderId}: ` +
          `charged=${chargedCents} ${chargedCurrency}, expected=${order.totalCents} ${expectedCurrency}`,
        );
        // Do not mark as paid; return 200 so Stripe stops retrying.
        return NextResponse.json({ received: true });
      }

      await db.order.update({
        where: { id: orderId },
        data: {
          status: "PAID",
          paymentStatus: "PAID",
          stripePaymentIntentId:
            typeof session.payment_intent === "string" ? session.payment_intent : null,
        },
      });
    }
  }

  if (event.type === "checkout.session.async_payment_failed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.orderId;

    if (orderId) {
      await db.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: "FAILED",
        },
      });
    }
  }

  return NextResponse.json({ received: true });
}
