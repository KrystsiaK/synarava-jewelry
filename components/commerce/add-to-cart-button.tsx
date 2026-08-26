"use client";

import { Check, X } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";

import { ArtifactLink, PrimaryCtaButton } from "@/components/ui";
import { trackCommerceEvent } from "@/lib/analytics/commerce";
import { useTranslations } from "@/lib/i18n/context";

type AddToCartButtonProps = {
  productSlug: string;
  merchandiseId?: string;
  disabled?: boolean;
  unavailableLabel?: string;
};

export function AddToCartButton({
  productSlug,
  merchandiseId,
  disabled = false,
  unavailableLabel,
}: AddToCartButtonProps) {
  const { t, plural } = useTranslations();
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
        body: JSON.stringify({ productSlug, merchandiseId, quantity: 1 }),
      });

      const payload = (await response.json()) as {
        ok: boolean;
        count?: number;
        error?: string;
      };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || t("product.addFailed"));
      }

      window.dispatchEvent(
        new CustomEvent("synarava:cart-updated", {
          detail: { count: payload.count ?? 0 },
        }),
      );

      trackCommerceEvent("add_to_cart", {
        productSlug,
        merchandiseId,
        quantity: 1,
        cartCount: payload.count ?? 0,
      });

      setRecentCount(payload.count ?? 0);
      setMessage(t("product.added"));
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : t("product.addFailed"));
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
        aria-label={t("product.closeConfirmation")}
      >
        <X className="size-4" aria-hidden="true" />
      </button>

      {isError ? (
        <div className="pr-10">
          <p className="font-serif text-xl text-white">{t("product.addFailedTitle")}</p>
          <p className="mt-2 text-sm leading-6 text-white/68">
            <span>{message}</span>
            <span> {t("product.tryAgain")}</span>
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-start gap-3 pr-10">
            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center border border-emerald-400/45 text-emerald-300">
              <Check className="size-4" strokeWidth={1.8} aria-hidden="true" />
            </span>
            <div>
              <p className="font-serif text-[1.45rem] leading-none text-white">{t("product.addedTitle")}</p>
              {recentCount !== null ? (
                <p className="mt-2 text-sm text-white/58">
                  {plural("product.cartCount", recentCount)}
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <ArtifactLink href="/cart" variant="secondary" size="md" className="flex-1 border-white/24 text-white hover:border-white hover:text-white">
              {t("product.viewCart")}
            </ArtifactLink>
            <PrimaryCtaButton
              href="/checkout"
              className="w-full flex-1"
              onClick={() => trackCommerceEvent("checkout_started", {
                source: "add_to_cart_confirmation",
                cartCount: recentCount,
              })}
            >
              {t("product.checkout")}
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
        disabled={isPending || disabled}
      >
        {disabled ? (unavailableLabel ?? t("product.currentlyUnavailable")) : isPending ? t("product.adding") : t("product.add")}
      </PrimaryCtaButton>

      {confirmation && typeof document !== "undefined"
        ? createPortal(confirmation, document.body)
        : null}
    </div>
  );
}
