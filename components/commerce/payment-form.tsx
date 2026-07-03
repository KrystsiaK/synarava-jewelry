"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { loadStripe, type Appearance, type StripeCheckoutElementsSdkOptions } from "@stripe/stripe-js";
import {
  CheckoutElementsProvider,
  PaymentElement,
  useCheckoutElements,
} from "@stripe/react-stripe-js/checkout";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

const elementsAppearance: Appearance = {
  theme: "flat",
  variables: {
    colorPrimary: "#a6192e",
    colorBackground: "#ffffff",
    colorText: "#191512",
    colorTextSecondary: "#6d655c",
    colorDanger: "#a6192e",
    fontFamily: "inherit",
    borderRadius: "0px",
    spacingUnit: "4px",
  },
  rules: {
    ".AccordionItem": {
      border: "1px solid rgba(25, 21, 18, 0.14)",
      boxShadow: "none",
      backgroundColor: "#ffffff",
    },
    ".AccordionItem:hover": {
      borderColor: "rgba(25, 21, 18, 0.28)",
    },
    ".AccordionItem--selected": {
      borderColor: "#a6192e",
      boxShadow: "0 0 0 1px #a6192e",
    },
    ".Block": {
      border: "1px solid rgba(25, 21, 18, 0.12)",
      boxShadow: "none",
      backgroundColor: "#ffffff",
    },
    ".Input": {
      border: "1px solid rgba(25, 21, 18, 0.18)",
      backgroundColor: "#ffffff",
      color: "#191512",
      padding: "12px 14px",
    },
    ".Input:focus": {
      border: "1px solid #a6192e",
      outline: "none",
      boxShadow: "none",
    },
    ".Label": {
      fontSize: "10px",
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      color: "#6d655c",
    },
    ".Tab": {
      border: "1px solid rgba(25, 21, 18, 0.14)",
      boxShadow: "none",
      backgroundColor: "#ffffff",
    },
    ".Tab:hover": {
      borderColor: "rgba(25, 21, 18, 0.28)",
    },
    ".Tab--selected": {
      borderColor: "#a6192e",
      color: "#191512",
      boxShadow: "0 0 0 1px #a6192e",
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

      <button
        type="submit"
        disabled={!isReady || loading}
        className="w-full inline-flex items-center justify-center bg-couture-red px-6 py-4 label-caps text-linen !text-linen transition-colors hover:bg-[#8f1325] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Processing…" : isReady ? "Pay now" : "Loading payment…"}
      </button>
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
