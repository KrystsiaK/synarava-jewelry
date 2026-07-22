"use client";

import { Check, X } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";

import { ArtifactLink, PrimaryCtaButton } from "@/components/ui";

type AddToCartButtonProps = {
  productSlug: string;
};

export function AddToCartButton({ productSlug }: AddToCartButtonProps) {
  const [isPending, setIsPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [recentCount, setRecentCount] = useState<number | null>(null);

  async function handleAdd() {
    setIsError(false);
    setIsPending(true);

    try {
      const response = await fetch("/api/cart/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productSlug, quantity: 1 }),
      });

      const payload = (await response.json()) as {
        ok: boolean;
        count?: number;
        error?: string;
      };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Could not add the piece to the cart.");
      }

      window.dispatchEvent(
        new CustomEvent("synarava:cart-updated", {
          detail: { count: payload.count ?? 0 },
        }),
      );

      setRecentCount(payload.count ?? 0);
      setMessage("Added to cart");
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "Could not add the piece to the cart.");
    } finally {
      setIsPending(false);
    }
  }

  const showPanel = Boolean(message);

  function dismissPanel() {
    setMessage(null);
    setRecentCount(null);
  }

  const confirmation = showPanel ? (
    <aside
      className={`cart-confirmation fixed bottom-4 right-4 z-[var(--z-toast)] w-[min(28rem,calc(100vw-2rem))] border bg-[rgba(12,12,14,0.94)] p-5 text-[#f3efe9] shadow-[0_8px_24px_rgba(0,0,0,0.34)] backdrop-blur-xl ${
        isError ? "border-[#ff75875c]" : "border-white/15"
      }`}
      aria-live="polite"
      aria-atomic="true"
      data-tone={isError ? "error" : "success"}
    >
      <button
        type="button"
        onClick={dismissPanel}
        className="absolute right-2 top-2 flex size-11 items-center justify-center text-white/58 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-couture-red"
        aria-label="Close cart confirmation"
      >
        <X className="size-4" aria-hidden="true" />
      </button>

      {isError ? (
        <div className="pr-10">
          <p className="font-serif text-xl text-white">Couldn’t add this piece.</p>
          <p className="mt-2 text-sm leading-6 text-white/68">
            <span>{message}</span>
            <span> Please try again.</span>
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-start gap-3 pr-10">
            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center border border-emerald-400/45 text-emerald-300">
              <Check className="size-4" strokeWidth={1.8} aria-hidden="true" />
            </span>
            <div>
              <p className="font-serif text-[1.45rem] leading-none text-white">Piece added to cart</p>
              {recentCount !== null ? (
                <p className="mt-2 text-sm text-white/58">
                  {recentCount} {recentCount === 1 ? "piece" : "pieces"} in cart
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <ArtifactLink href="/cart" variant="secondary" size="md" className="flex-1 border-white/24 text-white hover:border-white hover:text-white">
              View cart
            </ArtifactLink>
            <PrimaryCtaButton href="/checkout/shipping" className="w-full flex-1">
              Checkout
            </PrimaryCtaButton>
          </div>
        </>
      )}
    </aside>
  ) : null;

  return (
    <div className="relative">
      <PrimaryCtaButton
        type="button"
        onClick={handleAdd}
        disabled={isPending}
      >
        {isPending ? "Adding…" : "Add to cart"}
      </PrimaryCtaButton>

      {confirmation && typeof document !== "undefined"
        ? createPortal(confirmation, document.body)
        : null}
    </div>
  );
}
