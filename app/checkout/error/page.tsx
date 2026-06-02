import type { Metadata } from "next";
import Link from "next/link";

import { CheckoutShell } from "@/components/commerce/checkout-shell";

export const metadata: Metadata = {
  title: "Checkout Error | Synarava",
  description: "Error state for interrupted Synarava acquisition flow.",
};

type Props = {
  searchParams?: Promise<{
    reason?: string;
  }>;
};

const reasonMap: Record<string, string> = {
  shipping: "The shipping details were incomplete, so the acquisition could not continue.",
  payment: "The payment step lost its draft order context and needs to be restarted.",
  cart: "The cart is currently empty, so there is nothing to acquire.",
};

export default async function CheckoutErrorPage({ searchParams }: Props) {
  const params = (await searchParams) ?? {};
  const message =
    reasonMap[params.reason ?? ""] ??
    "The acquisition flow was interrupted before confirmation.";

  return (
    <CheckoutShell
      eyebrow="SYNARAVA | Connection Fragmented (Error)"
      title="The acquisition thread was interrupted."
      description="This error screen is intentionally explicit: it explains where the flow broke and gives a clean route back into the checkout path."
      step="error"
      aside={
        <section className="panel p-6">
          <p className="label-caps text-accent">What happened</p>
          <p className="mt-4 text-sm leading-6 text-foreground/65">{message}</p>
        </section>
      }
    >
      <section className="panel p-8 md:p-10">
        <p className="label-caps text-accent">Error state</p>
        <h2 className="mt-4 font-serif text-[2.4rem] leading-tight">Let’s reconnect the flow.</h2>
        <p className="mt-5 max-w-2xl text-base leading-8 text-foreground/68">{message}</p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/cart"
            className="inline-flex items-center justify-center bg-charcoal px-6 py-4 label-caps text-white transition-colors hover:bg-couture-red"
          >
            Return to cart
          </Link>
          <Link
            href="/checkout/shipping"
            className="inline-flex items-center justify-center border border-stroke px-6 py-4 label-caps transition-colors hover:border-accent hover:text-accent"
          >
            Restart shipping
          </Link>
        </div>
      </section>
    </CheckoutShell>
  );
}
