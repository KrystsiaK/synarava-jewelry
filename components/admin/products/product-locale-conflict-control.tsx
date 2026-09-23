"use client";

import { GitCompareArrows, RefreshCw } from "lucide-react";

import type { CatalogConflictSignals } from "@/lib/shopify/catalog-conflict-signals";
import { filterSignalsForView } from "@/components/admin/products/catalog-conflict-workspace";

function localeConflictCount(signals: CatalogConflictSignals, productId: string, locale: string) {
  const scoped = filterSignalsForView(signals, { kind: "productLocale", productId, locale });
  const signal = scoped.products[productId];
  if (!signal) return 0;
  const localeCount = signal.locales.reduce((sum, entry) => sum + entry.count, 0);
  return localeCount + (signal.shared || signal.presence ? 1 : 0);
}

/**
 * Same catalog conflict entry as `/admin/products`, scoped to the active product locale tab.
 */
export function ProductLocaleConflictControl({
  productId,
  locale,
  localeLabel,
  signals,
  checking,
  onOpen,
  onCheck,
}: {
  productId: string;
  locale: string;
  localeLabel: string;
  signals: CatalogConflictSignals;
  checking?: boolean;
  onOpen: () => void;
  onCheck: () => void;
}) {
  const count = localeConflictCount(signals, productId, locale);
  const hasConflicts = count > 0;

  return (
    <div className="adm-product-locale-conflict inline-flex items-center gap-1.5" data-state={hasConflicts ? "differences" : "current"}>
      {hasConflicts ? (
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[0.68rem] font-bold uppercase tracking-[0.04em]"
          style={{
            borderColor: "var(--adm-conflict)",
            background: "color-mix(in srgb, var(--adm-conflict) 14%, var(--adm-panel))",
            color: "var(--adm-conflict)",
          }}
          aria-label={`Show ${count} conflict${count === 1 ? "" : "s"} for ${localeLabel}`}
          title={`${count} conflict${count === 1 ? "" : "s"} for ${localeLabel}`}
        >
          <GitCompareArrows className="size-3.5" aria-hidden="true" />
          {count} {count === 1 ? "conflict" : "conflicts"}
        </button>
      ) : (
        <span className="text-[0.68rem] font-bold uppercase tracking-[0.04em] text-[var(--adm-subtle)]" role="status">
          No conflicts
        </span>
      )}
      <button
        type="button"
        onClick={onCheck}
        disabled={checking}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[var(--adm-border)] px-3 py-1.5 text-[0.68rem] font-bold uppercase tracking-[0.04em] text-[var(--adm-subtle)] hover:border-[var(--adm-border-strong)] hover:text-[var(--adm-accent)] disabled:opacity-60"
        aria-label={`Check ${localeLabel} conflicts against Shopify`}
      >
        <RefreshCw className={`size-3.5 ${checking ? "animate-spin" : ""}`} aria-hidden="true" />
        Check
      </button>
    </div>
  );
}
