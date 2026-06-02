"use client";

import { useEffect, useRef, useState } from "react";

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
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  async function handleAdd() {
    setIsError(false);
    setIsPending(true);

    try {
      const response = await fetch("/api/cart/items", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productSlug,
          quantity: 1,
        }),
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
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = window.setTimeout(() => {
        setMessage(null);
        setRecentCount(null);
      }, 2200);
    }
  }

  return (
    <div className="relative space-y-3">
      <button
        type="button"
        onClick={handleAdd}
        disabled={isPending}
        className="bg-charcoal px-12 py-5 label-caps text-linen transition-all hover:opacity-90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isPending ? "Adding…" : "Add to cart"}
      </button>

      <div
        aria-live="polite"
        className={`pointer-events-none absolute left-0 top-full z-10 mt-2 min-w-[13rem] border border-foreground/10 bg-[color:rgba(249,248,246,0.96)] px-4 py-3 text-sm shadow-[0_18px_40px_rgba(25,21,18,0.08)] backdrop-blur transition-all duration-300 ${
          message
            ? "translate-y-0 opacity-100"
            : "translate-y-1 opacity-0"
        }`}
      >
        <div className={isError ? "text-[color:#7e1a29]" : "text-foreground"}>
          {message}
        </div>
        {!isError && recentCount !== null ? (
          <div className="mt-1 label-caps text-foreground/55">Cart now holds {recentCount}</div>
        ) : null}
      </div>

      <div
        aria-live="polite"
        className={`text-sm transition-all duration-300 ${
          message
            ? "translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-1 opacity-0"
        } ${isError ? "text-[color:#7e1a29]" : "text-foreground/65"}`}
      >
        {message ? (isError ? "Please try again." : "Piece added without leaving the page.") : " "}
      </div>
    </div>
  );
}
