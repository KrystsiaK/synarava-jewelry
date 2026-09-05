"use client";

import { PrimaryCtaButton } from "@/components/ui";
import { trackCommerceEvent, type CommerceEcommerce } from "@/lib/analytics/commerce";
import { useTranslations } from "@/lib/i18n/context";

type CartSummaryPanelProps = {
  itemCount: number;
  subtotal: string;
  ctaHref?: string;
  ctaLabel?: string;
  ecommerce?: CommerceEcommerce;
  note?: string;
};

export function CartSummaryPanel({
  itemCount,
  subtotal,
  ctaHref,
  ctaLabel,
  ecommerce,
  note,
}: CartSummaryPanelProps) {
  const { t, plural } = useTranslations();
  return (
    <aside className="cart-summary-panel h-fit border border-stroke bg-panel/70 p-6 text-foreground backdrop-blur-md md:p-7">
      <div className="flex items-start justify-between gap-4">
        <p className="font-serif text-[1.65rem] leading-none">{t("cart.summary")}</p>
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-foreground/50">
          {plural("cart.itemCount", itemCount)}
        </span>
      </div>

      <div className="mt-7 border-y border-stroke">
        <div className="flex items-center justify-between py-4 text-sm">
          <span className="text-foreground/62">{t("cart.selected")}</span>
          <span className="font-semibold text-foreground">{itemCount}</span>
        </div>
        <div className="flex items-end justify-between gap-4 border-t border-stroke py-5">
          <span className="text-sm text-foreground/62">{t("cart.subtotal")}</span>
          <span className="font-serif text-[1.75rem] leading-none text-foreground">{subtotal}</span>
        </div>
      </div>

      {ctaHref && ctaLabel ? (
        <PrimaryCtaButton
          href={ctaHref}
          className="mt-7 w-full"
          onClick={() => ecommerce && trackCommerceEvent("begin_checkout", {
            ecommerce,
            metadata: {
              source: "cart_summary",
              itemCount,
            },
          })}
        >
          {ctaLabel}
        </PrimaryCtaButton>
      ) : null}

      {note ? <p className="mt-5 max-w-[32rem] text-sm leading-6 text-foreground/58">{note}</p> : null}
    </aside>
  );
}
