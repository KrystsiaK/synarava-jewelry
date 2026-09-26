"use client";

import { GitCompareArrows, RefreshCw, ShieldCheck } from "lucide-react";

import type { CatalogConflictSignals } from "@/lib/shopify/catalog-conflict-signals";
import {
  filterSignalsForView,
  type CatalogConflictViewScope,
} from "@/components/admin/products/catalog-conflict-workspace";
import { productConflictBadgeCount } from "@/components/admin/products/product-conflict-badge-count";
import { Tooltip } from "@/components/ui/tooltip";

function conflictCount(
  signals: CatalogConflictSignals,
  viewScope: Extract<CatalogConflictViewScope, { kind: "product" } | { kind: "productLocale" }>,
  commerceFieldCount?: number,
) {
  const scoped = filterSignalsForView(signals, viewScope);
  return productConflictBadgeCount(scoped.products[viewScope.productId], { commerceFieldCount });
}

/** Same chrome as `.adm-btn-ghost` icon square — 1px border, 8px radius. */
const iconBtn =
  "adm-btn-ghost grid size-12 shrink-0 place-items-center p-0 disabled:opacity-60";

const ICON_STROKE = 2.75;
const ICON_SIZE = "size-7";

/**
 * Compact catalog-conflict entry for the product editor.
 * Same dialogs as `/admin/products`, scoped to the whole product or one locale tab.
 */
export function ProductLocaleConflictControl({
  productId,
  locale,
  localeLabel,
  signals,
  checking,
  onOpen,
  onCheck,
  scope = "locale",
  checkIconOnly = false,
  /** Live inspect diff count — preferred over signal.shared boolean for commerce badges. */
  commerceFieldCount,
}: {
  productId: string;
  locale: string;
  localeLabel: string;
  signals: CatalogConflictSignals;
  checking?: boolean;
  onOpen: () => void;
  onCheck: () => void;
  /** Whole-product check vs active locale tab. */
  scope?: "product" | "locale";
  /** Icon + tooltip actions (header / locale strip). */
  checkIconOnly?: boolean;
  commerceFieldCount?: number;
}) {
  const viewScope =
    scope === "product"
      ? ({ kind: "product", productId } as const)
      : ({ kind: "productLocale", productId, locale } as const);
  const count = conflictCount(signals, viewScope, commerceFieldCount);
  const hasConflicts = count > 0;
  const statusLabel = hasConflicts
    ? `${count} conflict${count === 1 ? "" : "s"} for ${localeLabel}. Open to compare and choose Shopify or Synarava.`
    : `No conflicts for ${localeLabel}. Synarava matches the last Shopify conflict check.`;
  const checkLabel = `Check ${localeLabel} against Shopify for field differences`;

  if (checkIconOnly) {
    return (
      <div
        className="adm-product-locale-conflict inline-flex items-center gap-1.5"
        data-state={hasConflicts ? "differences" : "current"}
        data-scope={scope}
      >
        {hasConflicts ? (
          <Tooltip content={statusLabel}>
            <button
              type="button"
              onClick={onOpen}
              className={`${iconBtn} relative text-[var(--adm-conflict)]`}
              aria-label={`Show ${count} conflict${count === 1 ? "" : "s"} for ${localeLabel}`}
            >
              <GitCompareArrows className={ICON_SIZE} strokeWidth={ICON_STROKE} aria-hidden="true" />
              <span
                className="absolute -right-1 -top-1 grid min-w-[1.15rem] place-items-center rounded-full px-1 text-[0.62rem] font-bold leading-5 text-[var(--adm-panel)]"
                style={{ background: "var(--adm-conflict)" }}
              >
                {count > 99 ? "99+" : count}
              </span>
            </button>
          </Tooltip>
        ) : (
          <Tooltip content={statusLabel}>
            <span
              className={`${iconBtn} cursor-default text-[var(--adm-success)]`}
              role="status"
              aria-label={`No conflicts for ${localeLabel}`}
              tabIndex={0}
            >
              <ShieldCheck className={ICON_SIZE} strokeWidth={ICON_STROKE} aria-hidden="true" />
            </span>
          </Tooltip>
        )}
        <Tooltip content={checkLabel}>
          <button
            type="button"
            onClick={onCheck}
            disabled={checking}
            className={iconBtn}
            aria-label={checkLabel}
          >
            <RefreshCw className={`${ICON_SIZE} ${checking ? "animate-spin" : ""}`} strokeWidth={ICON_STROKE} aria-hidden="true" />
          </button>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="adm-product-locale-conflict inline-flex items-center gap-1.5" data-state={hasConflicts ? "differences" : "current"} data-scope={scope}>
      {hasConflicts ? (
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-[var(--adm-border)] px-3 py-1.5 text-[0.68rem] font-bold uppercase tracking-[0.04em] text-[var(--adm-conflict)]"
          aria-label={`Show ${count} conflict${count === 1 ? "" : "s"} for ${localeLabel}`}
          title={`${count} conflict${count === 1 ? "" : "s"} for ${localeLabel}`}
        >
          <GitCompareArrows className="size-3.5" strokeWidth={ICON_STROKE} aria-hidden="true" />
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
        className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-[var(--adm-border)] px-3 py-1.5 text-[0.68rem] font-bold uppercase tracking-[0.04em] text-[var(--adm-subtle)] hover:border-[var(--adm-border-strong)] hover:text-[var(--adm-accent)] disabled:opacity-60"
        aria-label={checkLabel}
      >
        <RefreshCw className={`size-3.5 ${checking ? "animate-spin" : ""}`} strokeWidth={ICON_STROKE} aria-hidden="true" />
        Check
      </button>
    </div>
  );
}
