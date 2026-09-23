"use client";

import { GitCompareArrows, Languages, RefreshCw } from "lucide-react";
import type { CatalogConflictProductSignal, CatalogConflictSignals } from "@/lib/shopify/catalog-conflict-signals";

function plural(count: number, singular: string, pluralWord: string) {
  return `${count} ${count === 1 ? singular : pluralWord}`;
}

function statusText(signals: CatalogConflictSignals) {
  const count = signals.totalCount;
  const saved = count === null
    ? "Conflict status unavailable"
    : count === 0
      ? "No saved conflicts"
      : `${plural(count, "product", "products")} with conflicts`;
  if (signals.state === "disconnected") return `Shopify disconnected · ${saved.toLowerCase()} may be outdated`;
  if (signals.state === "failed") return `${saved} · conflict status unavailable (last check failed)`;
  if (signals.state === "checking") return `${saved} · checking Shopify now`;
  if (signals.state === "stale") return `${saved} · check may be outdated`;
  return saved;
}

export function CatalogConflictStatus({
  signals,
  onShow,
  onCheck,
  checking = false,
  compact = false,
}: {
  signals: CatalogConflictSignals;
  onShow: () => void;
  onCheck: () => void;
  checking?: boolean;
  compact?: boolean;
}) {
  const hasConflicts = signals.totalCount !== null && signals.totalCount > 0;
  if (compact) {
    if (!hasConflicts) return null;
    return (
      <button
        type="button"
        onClick={onShow}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--adm-warning)]"
        style={{ borderColor: "var(--adm-warning)", background: "color-mix(in srgb, var(--adm-warning) 10%, var(--adm-panel))" }}
        aria-label="Show conflicts"
        title={statusText(signals)}
      >
        <GitCompareArrows className="size-4" style={{ color: "var(--adm-warning)" }} aria-hidden="true" />
        {plural(signals.totalCount!, "conflict", "conflicts")}
      </button>
    );
  }
  return (
    <div
      className={`flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 ${compact ? "text-xs" : "text-sm"}`}
      style={{
        borderColor: "color-mix(in srgb, var(--adm-warning) 52%, var(--adm-border))",
        background: "color-mix(in srgb, var(--adm-warning) 8%, var(--adm-panel))",
        color: "var(--adm-ink)",
      }}
      role="status"
    >
      <GitCompareArrows className="size-4 shrink-0" style={{ color: "var(--adm-warning)" }} aria-hidden="true" />
      <span className="font-semibold">{statusText(signals)}</span>
      {signals.totalCount !== null && signals.state !== "ready" && hasConflicts ? (
        <span className="text-[var(--adm-muted)]">{plural(signals.totalCount, "saved conflict", "saved conflicts")}</span>
      ) : null}
      {signals.state !== "ready" && signals.checkedAt ? (
        <time className="text-[var(--adm-muted)]" dateTime={signals.checkedAt} title="Last full translation check">
          Last full check {new Date(signals.checkedAt).toLocaleString()}
        </time>
      ) : null}
      {hasConflicts ? (
        <button type="button" onClick={onShow} className="adm-btn-secondary min-h-11 px-3 py-1 text-xs">
          Show conflicts
        </button>
      ) : null}
      <button
        type="button"
        onClick={onCheck}
        disabled={checking || signals.state === "checking" || signals.state === "disconnected"}
        className="adm-btn-ghost inline-flex min-h-11 items-center gap-1.5 px-3 py-1 text-xs"
      >
        <RefreshCw className={`size-3.5 ${(checking || signals.state === "checking") ? "animate-spin" : ""}`} aria-hidden="true" />
        {(checking || signals.state === "checking") ? "Checking conflicts…" : "Run conflict check"}
      </button>
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
  const fullDescription = [
    signal.shared ? "Shared commerce conflict" : null,
    ...signal.locales.map((locale) => `${locale.name} (${locale.code.toUpperCase()}): ${plural(locale.count, "field", "fields")}`),
  ].filter(Boolean).join("; ");
  return (
    <button
      type="button"
      onClick={onShow}
      aria-label={`Show conflicts for ${productName}: ${fullDescription}`}
      title={fullDescription}
      className="mt-2 flex min-h-11 max-w-full flex-wrap items-center gap-1.5 rounded-lg text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--adm-warning)]"
    >
      {signal.shared ? <span className="rounded-md border px-2 py-1 text-[0.68rem] font-semibold" style={{ borderColor: "var(--adm-warning)", color: "var(--adm-ink)" }}><GitCompareArrows className="mr-1 inline size-3" aria-hidden="true" />Shared · conflict</span> : null}
      {visible.map((locale) => (
        <span key={locale.code} className="rounded-md border px-2 py-1 text-[0.68rem] font-semibold" style={{ borderColor: "var(--adm-warning)", color: "var(--adm-ink)" }} title={locale.nativeName}>
          <Languages className="mr-1 inline size-3" aria-hidden="true" />{locale.code.toUpperCase()} · {plural(locale.count, "field", "fields")}
        </span>
      ))}
      {remaining > 0 ? <span className="text-[0.68rem] font-semibold text-[var(--adm-muted)]">+{plural(remaining, "language", "languages")}</span> : null}
    </button>
  );
}
