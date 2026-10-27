"use client";

import { GitCompareArrows, ShieldCheck } from "lucide-react";

import { Tooltip } from "@/components/ui/tooltip";

/** Same square as `.adm-icon-btn` (2rem). Glyph stays ~14px so it doesn't fill the control. */
const iconBtn =
  "adm-btn-ghost adm-icon-btn shrink-0 disabled:opacity-60";

const ICON_STROKE = 2;
const ICON_SIZE = "size-3.5";

export function formatSyncConflictLabel(count: number, label: string): string {
  return `${count} conflict${count === 1 ? "" : "s"} for ${label}`;
}

/**
 * ONE conflict indicator for list / entity / locale tab / section chrome.
 * Products, collections, and pages share this control. Pass `count` from
 * `lib/sync` `slice` / `selectSyncCounts` (or scoped signals). Text is always
 * "N conflict(s) for <label>".
 */
export function SyncConflictIndicator({
  label,
  count,
  onOpen,
  checkIconOnly = false,
}: {
  /** Human scope label — "this product", "English", "shared · media", … */
  label: string;
  /** Leaf count for this tree node / entity (from slice / select). */
  count: number;
  onOpen: () => void;
  /** Icon + tooltip (header / locale strip). */
  checkIconOnly?: boolean;
}) {
  const conflictTotal = Math.max(0, Math.trunc(count));
  const hasConflicts = conflictTotal > 0;
  const statusLabel = hasConflicts
    ? `${formatSyncConflictLabel(conflictTotal, label)}. Open to compare and choose Shopify or Synarava.`
    : `No conflicts for ${label}. Synarava matches the last Shopify conflict check.`;

  if (checkIconOnly) {
    return (
      <div
        className="adm-sync-conflict-indicator inline-flex items-center gap-1.5"
        data-component="SyncConflictIndicator"
        data-state={hasConflicts ? "differences" : "current"}
      >
        {hasConflicts ? (
          <Tooltip content={statusLabel}>
            <button
              type="button"
              onClick={onOpen}
              className={`${iconBtn} relative text-[var(--adm-conflict)]`}
              aria-label={formatSyncConflictLabel(conflictTotal, label)}
            >
              <GitCompareArrows className={ICON_SIZE} strokeWidth={ICON_STROKE} aria-hidden="true" />
              <span
                className="absolute -right-1 -top-1 grid min-w-[1.15rem] place-items-center rounded-full px-1 text-[0.62rem] font-bold leading-5 text-[var(--adm-panel)]"
                style={{ background: "var(--adm-conflict)" }}
              >
                {conflictTotal > 99 ? "99+" : conflictTotal}
              </span>
            </button>
          </Tooltip>
        ) : (
          <Tooltip content={statusLabel}>
            <span
              className={`${iconBtn} cursor-default text-[var(--adm-success)]`}
              role="status"
              aria-label={`No conflicts for ${label}`}
              tabIndex={0}
            >
              <ShieldCheck className={ICON_SIZE} strokeWidth={ICON_STROKE} aria-hidden="true" />
            </span>
          </Tooltip>
        )}
      </div>
    );
  }

  return (
    <div
      className="adm-sync-conflict-indicator inline-flex items-center gap-1.5"
      data-component="SyncConflictIndicator"
      data-state={hasConflicts ? "differences" : "current"}
    >
      {hasConflicts ? (
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-[var(--adm-border)] px-3 py-1.5 text-[0.68rem] font-bold uppercase tracking-[0.04em] text-[var(--adm-conflict)]"
          aria-label={formatSyncConflictLabel(conflictTotal, label)}
          title={formatSyncConflictLabel(conflictTotal, label)}
        >
          <GitCompareArrows className="size-3.5" strokeWidth={ICON_STROKE} aria-hidden="true" />
          {formatSyncConflictLabel(conflictTotal, label)}
        </button>
      ) : (
        <span className="text-[0.68rem] font-bold uppercase tracking-[0.04em] text-[var(--adm-subtle)]" role="status">
          No conflicts
        </span>
      )}
    </div>
  );
}
