"use client";

import { AlertTriangle } from "lucide-react";

import {
  productConflictCompareSummary,
} from "@/components/admin/products/product-conflict-compare-summary";
import type { CatalogConflictProductSignal } from "@/lib/shopify/catalog-conflict-signals";

/**
 * Product-editor conflict banner — same compare result as the conflict icon.
 * Do not feed raw unfiltered ShopifyFieldDivergence rows here.
 */
export function ProductConflictCompareBanner({
  signal,
  onOpen,
  className = "",
}: {
  signal: CatalogConflictProductSignal | null | undefined;
  onOpen: () => void;
  className?: string;
}) {
  const summary = productConflictCompareSummary(signal);
  if (summary.count <= 0) return null;

  const localeSuffix = summary.localeLabels.length > 0
    ? ` (${summary.localeLabels.join(", ")})`
    : "";
  const conflictWord = summary.count === 1 ? "conflict" : "conflicts";
  const differenceWord = summary.differenceCount === 1 ? "difference" : "differences";
  // Whole-item card says "N fields"; banner must not say "1 field" beside it.
  const headline = `${summary.count} ${conflictWord} (${summary.differenceCount} ${differenceWord})`;

  return (
    <div
      data-component="ProductConflictCompareBanner"
      role="alert"
      className={`grid gap-2 p-3 text-xs ${className}`}
      style={{
        border: "1px solid color-mix(in srgb, var(--adm-conflict) 55%, var(--adm-border))",
        background: "color-mix(in srgb, var(--adm-conflict) 12%, var(--adm-panel))",
        color: "var(--adm-conflict)",
        borderRadius: "8px",
      }}
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex min-h-11 items-start gap-2 text-left font-bold uppercase tracking-[0.08em] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--adm-conflict)]"
      >
        <AlertTriangle size={14} strokeWidth={1.8} className="mt-0.5 shrink-0" aria-hidden="true" />
        <span>
          {headline} from Shopify{localeSuffix}
        </span>
      </button>
    </div>
  );
}
