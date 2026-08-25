import type { Metadata } from "next";

import { CheckoutShell } from "@/components/commerce/checkout-shell";
import { ArtifactLink } from "@/components/ui/artifact-button";

export const metadata: Metadata = {
  title: "Checkout Error | Synarava",
  description: "Help for an interrupted Synarava checkout.",
};

type Props = {
  searchParams?: Promise<{
    reason?: string;
  }>;
};

const reasonMap: Record<string, string> = {
  shipping: "The delivery details were incomplete, so checkout could not continue.",
  payment: "The payment step lost the order context and needs to be restarted.",
  cart: "The cart is currently empty, so there is nothing to check out.",
  stripe: "Payment is temporarily unavailable. Your card has not been charged. Please return to the cart and try again later.",
};

export default async function CheckoutErrorPage({ searchParams }: Props) {
  const params = (await searchParams) ?? {};
  const message =
    reasonMap[params.reason ?? ""] ??
    "Checkout was interrupted before confirmation.";

  return (
    <CheckoutShell
      eyebrow="Checkout paused"
      title="Your order needs one more moment."
      description="Nothing has been charged. Return to your cart or restart delivery details when you are ready."
      step="error"
      aside={
        <section className="panel p-6">
          <p className="label-caps text-accent">What happened</p>
          <p className="mt-4 text-sm leading-6 text-foreground/65">{message}</p>
        </section>
      }
    >
      <section className="panel p-8 md:p-10">
        <p className="label-caps text-accent">What to do next</p>
        <h2 className="mt-4 font-serif text-[2.4rem] leading-tight">Your selection is still waiting.</h2>
        <p className="mt-5 max-w-2xl text-base leading-8 text-foreground/68">{message}</p>

        <div className="mt-8 flex flex-wrap gap-3">
          <ArtifactLink href="/cart">
            Return to cart
          </ArtifactLink>
          <ArtifactLink href="/checkout/shipping" variant="secondary">
            Restart shipping
          </ArtifactLink>
        </div>
      </section>
    </CheckoutShell>
  );
}
