import type { Metadata } from "next";
import Link from "next/link";

import { CheckoutShell } from "@/components/commerce/checkout-shell";
import { db } from "@/lib/db";

export const metadata: Metadata = {
  title: "Acquisition Confirmed | Synarava",
  description: "Confirmation page for a completed Synarava acquisition.",
};

type Props = {
  searchParams?: Promise<{
    order?: string;
  }>;
};

export default async function ConfirmedPage({ searchParams }: Props) {
  const params = (await searchParams) ?? {};
  const orderId = params.order?.trim();
  const order = orderId
    ? await db.order.findUnique({
        where: { id: orderId },
      })
    : null;

  return (
    <CheckoutShell
      eyebrow="SYNARAVA | Acquisition Confirmed"
      title="The acquisition has been recorded."
      description="Your order record has been written to the database and the current cart has been cleared. The next production pass can connect this step to live Stripe sessions and fulfillment events."
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
