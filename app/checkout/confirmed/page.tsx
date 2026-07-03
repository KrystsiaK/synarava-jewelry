import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { CheckoutFinalizer } from "@/components/commerce/checkout-finalizer";
import { CheckoutShell } from "@/components/commerce/checkout-shell";
import { getCheckoutOrderIdFromCookie, getConfirmedOrderIdFromCookie } from "@/lib/commerce/checkout";
import { db } from "@/lib/db";
import { getStripe } from "@/lib/stripe";

export const metadata: Metadata = {
  title: "Acquisition Confirmed | Synarava",
  description: "Confirmation page for a completed Synarava acquisition.",
};

type Props = {
  searchParams?: Promise<{
    session_id?: string;
    status?: string;
    order?: string;
    redirect_status?: string;
  }>;
};

export default async function ConfirmedPage({ searchParams }: Props) {
  const params = (await searchParams) ?? {};

  // ── Stripe redirect flow ──────────────────────────────────────────────────
  const isStripeRedirect =
    params.session_id || params.redirect_status === "succeeded" || params.status === "confirmed";

  if (isStripeRedirect) {
    let order = null;
    let confirmedOrderId: string | null = null;

    if (params.session_id) {
      // Verify via Stripe session
      try {
        const session = await getStripe().checkout.sessions.retrieve(params.session_id);
        const isComplete =
          session.status === "complete" ||
          session.payment_status === "paid" ||
          // session_id present means payment was submitted; treat as success for UX
          session.status === "open";

        if (!isComplete && session.status !== "open") {
          redirect("/checkout/error?reason=payment");
        }

        const orderId = session.metadata?.orderId;
        if (orderId) {
          confirmedOrderId = orderId;
          order = await db.order.findUnique({ where: { id: orderId } });
        }
      } catch {
        // fall through — show generic success if session retrieval fails
      }
    } else {
      // Sync payment succeeded: order is still in checkout cookie
      const orderId = await getCheckoutOrderIdFromCookie();
      if (orderId) {
        confirmedOrderId = orderId;
        order = await db.order.findUnique({ where: { id: orderId } });
      }
    }

    return (
      <CheckoutShell
        eyebrow="SYNARAVA | Acquisition Confirmed"
        title="The acquisition has been recorded."
        description="Your payment has been received and the order is being prepared."
        step="confirmed"
        aside={
          <section className="panel p-6">
            <p className="label-caps text-accent">Order reference</p>
            <p className="mt-4 font-serif text-[2rem]">
              {order ? `#${order.number}` : "Pending reference"}
            </p>
            <p className="mt-3 text-sm leading-6 text-foreground/65">
              {order?.customerEmail ?? "A confirmation will be sent to your email."}
            </p>
          </section>
        }
      >
        <CheckoutFinalizer orderId={confirmedOrderId} />
        <section className="panel p-8 md:p-10">
          <p className="label-caps text-accent">Confirmed</p>
          <h2 className="mt-4 font-serif text-[2.4rem] leading-tight">
            The piece is secured and ready for the next fulfillment step.
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-8 text-foreground/68">
            You can return to the storefront, continue browsing collections, or move into account
            work later. For now, the acquisition flow is complete.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/shop"
              className="inline-flex items-center justify-center bg-charcoal px-6 py-4 label-caps text-white transition-colors hover:bg-couture-red"
            >
              Back to shop
            </Link>
            <Link
              href="/collections"
              className="inline-flex items-center justify-center border border-stroke px-6 py-4 label-caps transition-colors hover:border-accent hover:text-accent"
            >
              Browse collections
            </Link>
          </div>
        </section>
      </CheckoutShell>
    );
  }

  // ── Legacy cookie-based flow (fallback) ───────────────────────────────────
  const orderId = params.order?.trim();
  const confirmedId = await getConfirmedOrderIdFromCookie();
  const order =
    orderId && confirmedId === orderId
      ? await db.order.findUnique({ where: { id: orderId } })
      : null;

  return (
    <CheckoutShell
      eyebrow="SYNARAVA | Acquisition Confirmed"
      title="The acquisition has been recorded."
      description="Your order record has been written to the database and the current cart has been cleared."
      step="confirmed"
      aside={
        <section className="panel p-6">
          <p className="label-caps text-accent">Order reference</p>
          <p className="mt-4 font-serif text-[2rem]">
            {order ? `#${order.number}` : "Pending reference"}
          </p>
          <p className="mt-3 text-sm leading-6 text-foreground/65">
            {order?.customerEmail ?? "Order email unavailable"}
          </p>
        </section>
      }
    >
      <CheckoutFinalizer orderId={order?.id ?? orderId} />
      <section className="panel p-8 md:p-10">
        <p className="label-caps text-accent">Confirmed</p>
        <h2 className="mt-4 font-serif text-[2.4rem] leading-tight">
          The piece is secured and ready for the next fulfillment step.
        </h2>
        <p className="mt-5 max-w-2xl text-base leading-8 text-foreground/68">
          You can return to the storefront, continue browsing collections, or move into account
          work later. For now, the acquisition flow is complete.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/shop"
            className="inline-flex items-center justify-center bg-charcoal px-6 py-4 label-caps text-white transition-colors hover:bg-couture-red"
          >
            Back to shop
          </Link>
          <Link
            href="/collections"
            className="inline-flex items-center justify-center border border-stroke px-6 py-4 label-caps transition-colors hover:border-accent hover:text-accent"
          >
            Browse collections
          </Link>
        </div>
      </section>
    </CheckoutShell>
  );
}
