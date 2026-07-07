"use client";

import { useEffect, useRef, useState } from "react";

import { ArtifactButton, ArtifactLink } from "@/components/ui";

type AddToCartButtonProps = {
  productSlug: string;
};

export function AddToCartButton({ productSlug }: AddToCartButtonProps) {
  const [isPending, setIsPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [recentCount, setRecentCount] = useState<number | null>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, []);

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
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      // Give user 5s to click the CTAs before dismissing
      timeoutRef.current = window.setTimeout(() => {
        setMessage(null);
        setRecentCount(null);
      }, 5000);
    }
  }

  const showPanel = Boolean(message);

  return (
    <div className="relative">
      <ArtifactButton
        type="button"
        onClick={handleAdd}
        disabled={isPending}
        className="px-12 py-5"
      >
        {isPending ? "Adding…" : "Add to cart"}
      </ArtifactButton>

      {/* Toast panel */}
      <div
        aria-live="polite"
        className={`absolute left-0 top-full z-20 mt-2 w-[min(22rem,90vw)] border border-foreground/10 bg-[color:rgba(249,248,246,0.97)] shadow-[0_18px_48px_rgba(25,21,18,0.11)] backdrop-blur transition-all duration-300 ${
          showPanel ? "translate-y-0 opacity-100 pointer-events-auto" : "translate-y-1 opacity-0 pointer-events-none"
        }`}
      >
        {isError ? (
          <div className="px-5 py-4">
            <p className="text-sm text-[color:#7e1a29]">{message}</p>
            <p className="mt-1 text-xs text-foreground/50">Please try again.</p>
          </div>
        ) : (
          <div className="px-5 py-4">
            <div className="flex items-center gap-2 mb-3">
              {/* Green check */}
              <svg viewBox="0 0 16 16" className="size-3.5 shrink-0 text-emerald-600" fill="none">
                <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4" />
                <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <p className="label-caps text-foreground text-[0.72rem]">Piece added to cart</p>
            </div>

            {recentCount !== null && (
              <p className="label-mono text-[0.68rem] text-foreground/45 mb-4">
                {recentCount} {recentCount === 1 ? "piece" : "pieces"} in cart
              </p>
            )}

            {/* CTAs */}
            <div className="flex gap-2">
              <ArtifactLink
                href="/cart"
                variant="secondary"
                size="sm"
                className="flex-1"
              >
                View cart
              </ArtifactLink>
              <ArtifactLink
                href="/checkout/shipping"
                size="sm"
                className="flex-1"
              >
                Checkout
              </ArtifactLink>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
