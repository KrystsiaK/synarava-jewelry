"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { loadStripe, type Appearance, type StripeCheckoutElementsSdkOptions } from "@stripe/stripe-js";
import {
  CheckoutElementsProvider,
  PaymentElement,
  useCheckoutElements,
} from "@stripe/react-stripe-js/checkout";

import { PrimaryCtaButton } from "@/components/ui";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

const elementsAppearance: Appearance = {
  theme: "night",
  variables: {
    colorPrimary: "#d62f44",
    colorBackground: "rgba(255,255,255,0.055)",
    colorText: "#f1efec",
    colorTextSecondary: "#b9b4ae",
    colorDanger: "#ff7587",
    fontFamily: "inherit",
    borderRadius: "0px",
    spacingUnit: "4px",
  },
  rules: {
    ".AccordionItem": {
      border: "1px solid rgba(255,255,255,0.14)",
      boxShadow: "none",
      backgroundColor: "rgba(255,255,255,0.035)",
    },
    ".AccordionItem:hover": {
      borderColor: "rgba(255,255,255,0.3)",
    },
    ".AccordionItem--selected": {
      borderColor: "#d62f44",
      boxShadow: "0 0 0 1px #d62f44",
    },
    ".Block": {
      border: "1px solid rgba(255,255,255,0.12)",
      boxShadow: "none",
      backgroundColor: "rgba(255,255,255,0.035)",
    },
    ".Input": {
      border: "1px solid rgba(255,255,255,0.16)",
      backgroundColor: "rgba(255,255,255,0.055)",
      color: "#f1efec",
      padding: "12px 14px",
    },
    ".Input:focus": {
      border: "1px solid #d62f44",
      outline: "none",
      boxShadow: "none",
    },
    ".Label": {
      fontSize: "10px",
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      color: "#b9b4ae",
    },
    ".Tab": {
      border: "1px solid rgba(255,255,255,0.14)",
      boxShadow: "none",
      backgroundColor: "rgba(255,255,255,0.035)",
    },
    ".Tab:hover": {
      borderColor: "rgba(255,255,255,0.3)",
    },
    ".Tab--selected": {
      borderColor: "#d62f44",
      color: "#f1efec",
      boxShadow: "0 0 0 1px #d62f44",
    },
  },
};

function CheckoutForm() {
  const checkoutResult = useCheckoutElements();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (checkoutResult.type !== "success") return;

    setLoading(true);
    setError(null);

    let result: Awaited<ReturnType<typeof checkoutResult.checkout.confirm>>;
    try {
      result = await checkoutResult.checkout.confirm({
        redirect: "if_required",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed. Please try again.");
      setLoading(false);
      return;
    }

    if (result.type === "error") {
      setError(result.error.message ?? "Payment failed. Please try again.");
      setLoading(false);
      return;
    }

    router.push("/checkout/confirmed?status=confirmed");
    router.refresh();
  }

  const providerError = checkoutResult.type === "error" ? checkoutResult.error.message : null;
  const isReady = checkoutResult.type === "success";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement
        options={{
          layout: "accordion",
        }}
      />

      {(error || providerError) && (
        <p className="text-sm text-couture-red leading-5">{error ?? providerError}</p>
      )}

      <PrimaryCtaButton
        type="submit"
        disabled={!isReady || loading}
        className="w-full"
      >
        {loading ? "Processing…" : isReady ? "Pay now" : "Loading payment…"}
      </PrimaryCtaButton>
    </form>
  );
}

type PaymentFormProps = {
  clientSecret: string;
};

export function PaymentForm({ clientSecret }: PaymentFormProps) {
  const options: StripeCheckoutElementsSdkOptions = {
    clientSecret,
    elementsOptions: {
      appearance: elementsAppearance,
    },
  };

  return (
    <CheckoutElementsProvider stripe={stripePromise} options={options}>
      <CheckoutForm />
    </CheckoutElementsProvider>
  );
}
