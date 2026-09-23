"use client";

import { ProductLocaleConflictControl } from "@/components/admin/products/product-locale-conflict-control";
import type { CatalogConflictSignals } from "@/lib/shopify/catalog-conflict-signals";

/**
 * Compact sync/conflict strip reused at product, locale, and section branches.
 * Same check/open conflict actions; copy describes which tree level is in scope.
 */
export function ProductBranchSyncBar({
  level,
  productId,
  locale,
  localeLabel,
  sectionLabel,
  signals,
  checking,
  dirty,
  onOpen,
  onCheck,
  onSaveBranch,
  savePending,
  showSaveBranch = false,
}: {
  level: "product" | "locale" | "section";
  productId: string;
  locale: string;
  localeLabel: string;
  sectionLabel?: string;
  signals: CatalogConflictSignals;
  checking?: boolean;
  dirty?: boolean;
  onOpen: () => void;
  onCheck: () => void;
  onSaveBranch?: () => void;
  savePending?: boolean;
  showSaveBranch?: boolean;
}) {
  const scopeLabel = level === "product"
    ? "Whole product"
    : level === "locale"
      ? `${localeLabel} locale`
      : `${sectionLabel ?? "Section"} · ${localeLabel}`;

  return (
    <div
      data-component="ProductBranchSyncBar"
      data-level={level}
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--adm-border)] bg-[var(--adm-bg-soft)] px-3 py-2.5"
    >
      <div className="min-w-0">
        <p className="text-[0.68rem] font-bold uppercase tracking-[0.08em] text-[var(--adm-subtle)]">
          Sync · {scopeLabel}
        </p>
        <p className="mt-0.5 text-xs text-[var(--adm-muted)]">
          {dirty
            ? "This branch has unsaved edits. Save the branch before relying on Shopify push/pull for these fields."
            : "Check and resolve Shopify differences for this branch only. Other unsaved tabs stay in the form."}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {showSaveBranch && onSaveBranch ? (
          <button
            type="button"
            className="adm-btn-secondary min-h-11 px-3 text-[0.68rem] font-bold uppercase tracking-[0.04em]"
            onClick={onSaveBranch}
            disabled={savePending || !dirty}
          >
            {savePending ? "Saving…" : "Save this branch"}
          </button>
        ) : null}
        <ProductLocaleConflictControl
          productId={productId}
          locale={locale}
          localeLabel={scopeLabel}
          signals={signals}
          checking={checking}
          onOpen={onOpen}
          onCheck={onCheck}
        />
      </div>
    </div>
  );
}
