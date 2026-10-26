"use client";

import { GitCompareArrows, Languages } from "lucide-react";

import { AdminButton } from "@/components/admin/shared/admin-button";
import type { CatalogConflictProductSignal, CatalogConflictSignals } from "@/lib/shopify/catalog-conflict-signals";
import { formatAdminDateTime } from "@/lib/format/admin-date";

function plural(count: number, singular: string, pluralWord: string) {
  return `${count} ${count === 1 ? singular : pluralWord}`;
}

function statusText(signals: CatalogConflictSignals) {
  if (signals.state === "unknown") return "Conflict status unknown";
  if (signals.state === "failed") return "Last check failed or partial";
  const count = signals.totalCount;
  if (count === null) return "Conflict status unavailable";
  const unchecked = signals.uncheckedCount ?? 0;
  const uncheckedNote = unchecked > 0
    ? ` · ${plural(unchecked, "row", "rows")} not checked`
    : "";
  if (count === 0) {
    return unchecked > 0 ? `No conflicts${uncheckedNote}` : "No conflicts";
  }
  return `${plural(count, "conflict", "conflicts")}${uncheckedNote}`;
}

const conflictTone = {
  border: "var(--adm-conflict)",
  borderSoft: "color-mix(in srgb, var(--adm-conflict) 55%, var(--adm-border))",
  fill: "color-mix(in srgb, var(--adm-conflict) 14%, var(--adm-panel))",
  fillSoft: "color-mix(in srgb, var(--adm-conflict) 10%, var(--adm-panel))",
  ink: "var(--adm-conflict)",
} as const;

export function CatalogConflictStatus({
  signals,
  onShow,
  compact = false,
}: {
  signals: CatalogConflictSignals;
  onShow: () => void;
  compact?: boolean;
  /** Ignored — counters are always leaf conflicts ("N conflicts"). */
  entityNoun?: { singular: string; plural: string };
}) {
  const hasConflicts = signals.totalCount !== null && signals.totalCount > 0;
  if (compact) {
    if (!hasConflicts) return null;
    return (
      <button
        type="button"
        onClick={onShow}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--adm-conflict)]"
        style={{ borderColor: conflictTone.border, background: conflictTone.fill }}
        title={statusText(signals)}
      >
        <GitCompareArrows className="size-4" style={{ color: conflictTone.ink }} aria-hidden="true" />
        {plural(signals.totalCount!, "conflict", "conflicts")}
      </button>
    );
  }
  return (
    <div
      className="flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 text-sm"
      style={{
        borderColor: conflictTone.borderSoft,
        background: conflictTone.fillSoft,
        color: "var(--adm-ink)",
      }}
      role="status"
    >
      <GitCompareArrows className="size-4 shrink-0" style={{ color: conflictTone.ink }} aria-hidden="true" />
      <span className="font-semibold">{statusText(signals)}</span>
      {signals.checkedAt ? (
        <time
          className="text-[var(--adm-muted)]"
          dateTime={signals.checkedAt}
          title="Last full conflict check"
        >
          Last full check {formatAdminDateTime(signals.checkedAt)}
        </time>
      ) : null}
      {hasConflicts ? (
        <AdminButton variant="secondary" onClick={onShow} className="min-h-11 px-3 py-1 text-xs">
          Show conflicts
        </AdminButton>
      ) : null}
    </div>
  );
}

export function CatalogConflictRowBadges({
  productName,
  signal,
  onShow,
}: {
  productName: string;
  signal: CatalogConflictProductSignal;
  onShow: () => void;
}) {
  const visible = signal.locales.slice(0, 2);
  const remaining = signal.locales.length - visible.length;
  const presenceLabel = signal.presence === "SHOPIFY_ONLY"
    ? signal.localProductId ? "Not linked" : "Only in Shopify"
    : signal.presence === "SYNARAVA_ONLY"
      ? signal.remoteMissing ? "Missing in Shopify" : "Only in Synarava"
      : null;
  const fullDescription = [
    presenceLabel,
    !presenceLabel && signal.shared ? "Shared commerce conflict" : null,
    ...signal.locales.map((locale) => `${locale.name} (${locale.code.toUpperCase()}): ${plural(locale.count, "field", "fields")}`),
  ].filter(Boolean).join("; ");
  return (
    <button
      type="button"
      onClick={onShow}
      aria-label={`Show conflicts for ${productName}: ${fullDescription}`}
      title={fullDescription}
      className="mt-2 flex min-h-11 max-w-full flex-wrap items-center gap-1.5 rounded-lg text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--adm-conflict)]"
    >
      {presenceLabel ? <span className="rounded-md border px-2 py-1 text-[0.68rem] font-semibold" style={{ borderColor: conflictTone.border, color: "var(--adm-ink)" }}><GitCompareArrows className="mr-1 inline size-3" style={{ color: conflictTone.ink }} aria-hidden="true" />{presenceLabel}</span> : null}
      {!presenceLabel && signal.shared ? <span className="rounded-md border px-2 py-1 text-[0.68rem] font-semibold" style={{ borderColor: conflictTone.border, color: "var(--adm-ink)" }}><GitCompareArrows className="mr-1 inline size-3" style={{ color: conflictTone.ink }} aria-hidden="true" />Shared · conflict</span> : null}
      {visible.map((locale) => (
        <span key={locale.code} className="rounded-md border px-2 py-1 text-[0.68rem] font-semibold" style={{ borderColor: conflictTone.border, color: "var(--adm-ink)" }} title={locale.nativeName}>
          <Languages className="mr-1 inline size-3" style={{ color: conflictTone.ink }} aria-hidden="true" />{locale.code.toUpperCase()} · {plural(locale.count, "field", "fields")}
        </span>
      ))}
      {remaining > 0 ? <span className="text-[0.68rem] font-semibold text-[var(--adm-muted)]">+{plural(remaining, "language", "languages")}</span> : null}
    </button>
  );
}
