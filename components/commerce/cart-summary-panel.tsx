import Link from "next/link";

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
    <aside className="panel h-fit p-6">
      <p className="label-caps text-accent">Summary</p>
      <div className="mt-6 space-y-4">
        <div className="flex items-center justify-between border-b border-stroke pb-4">
          <span className="text-foreground/70">Items</span>
          <span className="font-mono text-sm uppercase tracking-[0.14em]">{itemCount}</span>
        </div>
        <div className="flex items-center justify-between border-b border-stroke pb-4">
          <span className="text-foreground/70">Subtotal</span>
          <span className="font-mono text-sm uppercase tracking-[0.14em]">{subtotal}</span>
        </div>
      </div>

      {ctaHref && ctaLabel ? (
        <Link
          href={ctaHref}
          className="mt-8 inline-flex w-full items-center justify-center bg-charcoal px-6 py-4 text-center label-caps text-white transition-colors hover:bg-couture-red"
        >
          {ctaLabel}
        </Link>
      ) : null}

      {note ? <p className="mt-6 text-sm leading-6 text-foreground/60">{note}</p> : null}
    </aside>
  );
}
