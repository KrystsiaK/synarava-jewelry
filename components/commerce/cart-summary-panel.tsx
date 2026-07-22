import { PrimaryCtaButton } from "@/components/ui";

type CartSummaryPanelProps = {
  itemCount: number;
  subtotal: string;
  ctaHref?: string;
  ctaLabel?: string;
  note?: string;
};

export function CartSummaryPanel({
  itemCount,
  subtotal,
  ctaHref,
  ctaLabel,
  note,
}: CartSummaryPanelProps) {
  return (
    <aside className="cart-summary-panel h-fit border border-white/10 bg-white/[0.035] p-6 text-foreground backdrop-blur-md md:p-7">
      <div className="flex items-start justify-between gap-4">
        <p className="font-serif text-[1.65rem] leading-none">Order summary</p>
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-foreground/50">
          {String(itemCount).padStart(2, "0")} {itemCount === 1 ? "piece" : "pieces"}
        </span>
      </div>

      <div className="mt-7 border-y border-white/10">
        <div className="flex items-center justify-between py-4 text-sm">
          <span className="text-foreground/62">Selected pieces</span>
          <span className="font-semibold text-foreground">{itemCount}</span>
        </div>
        <div className="flex items-end justify-between gap-4 border-t border-white/10 py-5">
          <span className="text-sm text-foreground/62">Subtotal</span>
          <span className="font-serif text-[1.75rem] leading-none text-foreground">{subtotal}</span>
        </div>
      </div>

      {ctaHref && ctaLabel ? (
        <PrimaryCtaButton href={ctaHref} className="mt-7 w-full">
          {ctaLabel}
        </PrimaryCtaButton>
      ) : null}

      {note ? <p className="mt-5 max-w-[32rem] text-sm leading-6 text-foreground/58">{note}</p> : null}
    </aside>
  );
}
