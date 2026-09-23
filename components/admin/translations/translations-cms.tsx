"use client";

import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Check, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import type {
  ReconcileDifferenceView,
  ReconcileRunSummary,
} from "@/lib/shopify/reconciliation-run";

export type ReconcileDifferenceRow = ReconcileDifferenceView & { href: string };
type DifferenceFilter = "ALL" | ReconcileDifferenceView["kind"];
type ReconcileChoice = "SYNARAVA" | "SHOPIFY";

const FILTERS: Array<{ value: DifferenceFilter; label: string }> = [
  { value: "ALL", label: "All changes" },
  { value: "CONFLICT", label: "Needs a decision" },
  { value: "LOCAL_ONLY", label: "From Synarava" },
  { value: "SHOPIFY_ONLY", label: "From Shopify" },
];

function friendlyKey(value: string) {
  return value
    .replaceAll(".", " · ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .replace(/^./, (character) => character.toUpperCase());
}

function ValuePreview({ value, emptyLabel = "Empty" }: { value: unknown; emptyLabel?: string }) {
  if (value === null || value === undefined || value === "") {
    return <span className="adm-merge-empty">{emptyLabel}</span>;
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return <p className="adm-merge-copy">{String(value)}</p>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="adm-merge-empty">{emptyLabel}</span>;
    return (
      <ol className="adm-merge-structured">
        {value.map((item, index) => (
          <li key={index}>
            <span className="adm-merge-structured__index">{index + 1}</span>
            <ValuePreview value={item} />
          </li>
        ))}
      </ol>
    );
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return <span className="adm-merge-empty">{emptyLabel}</span>;
    return (
      <dl className="adm-merge-structured">
        {entries.map(([key, nested]) => (
          <div key={key}>
            <dt>{friendlyKey(key)}</dt>
            <dd><ValuePreview value={nested} /></dd>
          </div>
        ))}
      </dl>
    );
  }
  return <p className="adm-merge-copy">{String(value)}</p>;
}

function kindCopy(kind: ReconcileDifferenceView["kind"]) {
  if (kind === "CONFLICT") return {
    label: "Changed in both",
    hint: "Review both versions before choosing. No side is selected automatically.",
    icon: AlertTriangle,
  };
  if (kind === "LOCAL_ONLY") return {
    label: "Changed in Synarava",
    hint: "Shopify still has the last synced version.",
    icon: ArrowUpFromLine,
  };
  return {
    label: "Changed in Shopify",
    hint: "Synarava still has the last synced version.",
    icon: ArrowDownToLine,
  };
}

function runPresentation(run: ReconcileRunSummary | null, differenceCount: number) {
  if (!run || run.status === "QUEUED" || run.status === "RUNNING") return {
    tone: "checking",
    title: "Checking translated content",
    body: "Comparing Synarava with Shopify. This check is read-only.",
  };
  if (run.status === "FAILED") return {
    tone: "unavailable",
    title: "Shopify could not be checked",
    body: run.error ?? "Check the Shopify connection and try again.",
  };
  if (run.status === "PARTIAL") return {
    tone: "partial",
    title: "Some content could not be checked",
    body: run.error ?? "The verified results are shown below; unchecked content is not marked as current.",
  };
  if (differenceCount > 0) return {
    tone: "differences",
    title: `${differenceCount} translated field${differenceCount === 1 ? "" : "s"} need review`,
    body: "Each change is shown with the Synarava and Shopify versions side by side.",
  };
  return {
    tone: "current",
    title: "Everything checked matches",
    body: "No translated fields differ between Synarava and Shopify.",
  };
}

function groupKey(row: ReconcileDifferenceRow) {
  return `${row.rootEntityType}:${row.rootEntityId}:${row.locale}`;
}

function entityTypeLabel(type: ReconcileDifferenceView["rootEntityType"]) {
  if (type === "STOREFRONT_COPY") return "Header & Footer";
  return type.charAt(0) + type.slice(1).toLowerCase();
}

function localeLabel(locale: string) {
  if (locale.toLowerCase().startsWith("pt")) return "Portuguese";
  if (locale.toLowerCase().startsWith("en")) return "English";
  return locale;
}

function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value as Record<string, unknown>).length === 0;
  return false;
}

export function TranslationsCms({
  initialRun,
  differences,
}: {
  initialRun: ReconcileRunSummary | null;
  differences: ReconcileDifferenceRow[];
}) {
  const [filter, setFilter] = useState<DifferenceFilter>("ALL");
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [choices, setChoices] = useState<Record<string, ReconcileChoice>>({});
  const [acknowledgedClears, setAcknowledgedClears] = useState(false);
  const [acknowledgedBatch, setAcknowledgedBatch] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyMessage, setApplyMessage] = useState<string | null>(null);
  const router = useRouter();
  const presentation = runPresentation(
    checking && initialRun ? { ...initialRun, status: "RUNNING" } : initialRun,
    differences.length,
  );
  const visible = useMemo(
    () => filter === "ALL" ? differences : differences.filter((difference) => difference.kind === filter),
    [differences, filter],
  );
  const grouped = useMemo(() => {
    const groups = new Map<string, ReconcileDifferenceRow[]>();
    for (const row of visible) groups.set(groupKey(row), [...(groups.get(groupKey(row)) ?? []), row]);
    return [...groups.values()];
  }, [visible]);
  const selected = useMemo(
    () => differences.flatMap((difference) => choices[difference.id]
      ? [{ difference, choice: choices[difference.id] }]
      : []),
    [choices, differences],
  );
  const shopifyWriteCount = selected.filter(({ choice }) => choice === "SYNARAVA").length;
  const localWriteCount = selected.filter(({ choice }) => choice === "SHOPIFY").length;
  const clearCount = selected.filter(({ difference, choice }) =>
    isEmptyValue(choice === "SYNARAVA" ? difference.localValue : difference.shopifyValue)).length;

  async function checkNow() {
    setChecking(true);
    setCheckError(null);
    try {
      const response = await fetch("/admin/api/shopify/reconcile", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ trigger: "MANUAL" }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Shopify check could not be completed.");
      router.refresh();
    } catch (error) {
      setCheckError(error instanceof Error ? error.message : "Shopify check could not be completed.");
    } finally {
      setChecking(false);
    }
  }

  function choose(divergenceId: string, choice: ReconcileChoice) {
    setApplyMessage(null);
    setAcknowledgedClears(false);
    setAcknowledgedBatch(false);
    setChoices((current) => current[divergenceId] === choice
      ? Object.fromEntries(Object.entries(current).filter(([id]) => id !== divergenceId))
      : { ...current, [divergenceId]: choice });
  }

  async function applyChoices() {
    if (selected.length === 0
      || (clearCount > 0 && !acknowledgedClears)
      || (selected.length > 1 && !acknowledgedBatch)) return;
    setApplying(true);
    setApplyMessage(null);
    try {
      const response = await fetch("/admin/api/shopify/reconcile/apply", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          choices: selected.map(({ difference, choice }) => ({
            divergenceId: difference.id,
            choice,
            expectedLocalFingerprint: difference.localFingerprint,
            expectedShopifyFingerprint: difference.shopifyFingerprint,
          })),
        }),
      });
      const payload = await response.json().catch(() => ({})) as {
        error?: string;
        appliedCount?: number;
        failedCount?: number;
        results?: Array<{ ok: boolean; message: string }>;
      };
      if (!response.ok && !payload.results) throw new Error(payload.error || "The selected changes could not be applied.");

      const applied = payload.appliedCount ?? 0;
      const failed = payload.failedCount ?? 0;
      setApplyMessage(failed > 0
        ? `${applied} applied. ${failed} need another review: ${payload.results?.find((result) => !result.ok)?.message ?? "check again"}`
        : `${applied} change${applied === 1 ? "" : "s"} applied and verified.`);
      setChoices({});
      setAcknowledgedClears(false);
      setAcknowledgedBatch(false);

      if (applied > 0) {
        await fetch("/admin/api/shopify/reconcile", {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ trigger: "MANUAL" }),
        });
      }
      router.refresh();
    } catch (error) {
      setApplyMessage(error instanceof Error ? error.message : "The selected changes could not be applied.");
    } finally {
      setApplying(false);
    }
  }

  return (
    <section className="grid gap-5" data-component="TranslationsCms">
      <div className="adm-sync-overview" data-tone={presentation.tone}>
        <div className="adm-sync-overview__status" aria-live="polite">
          <span className="adm-sync-overview__mark" aria-hidden="true">
            {presentation.tone === "current" ? <Check size={18} /> : presentation.tone === "checking" ? <RefreshCw size={18} /> : <AlertTriangle size={18} />}
          </span>
          <div>
            <h2>{presentation.title}</h2>
            <p>{checkError ?? presentation.body}</p>
            {initialRun ? (
              <p className="adm-sync-overview__meta">
                {initialRun.checkedCount} resource{initialRun.checkedCount === 1 ? "" : "s"} checked
                {initialRun.completedAt ? ` · ${new Date(initialRun.completedAt).toLocaleString("en")}` : ""}
              </p>
            ) : null}
          </div>
        </div>
        <button type="button" className="adm-btn-ghost" onClick={() => void checkNow()} disabled={checking}>
          <RefreshCw size={15} className={checking ? "animate-spin" : ""} aria-hidden="true" />
          {checking ? "Checking…" : "Check now"}
        </button>
      </div>

      {differences.length > 0 ? (
        <div className="adm-sync-toolbar" aria-label="Filter sync changes">
          <div className="adm-sync-filters" role="group" aria-label="Change source">
            {FILTERS.map((item) => {
              const count = item.value === "ALL"
                ? differences.length
                : differences.filter((difference) => difference.kind === item.value).length;
              return (
                <button
                  key={item.value}
                  type="button"
                  data-active={filter === item.value ? "true" : undefined}
                  onClick={() => setFilter(item.value)}
                >
                  {item.label}<span>{count}</span>
                </button>
              );
            })}
          </div>
          <p>Showing only fields whose values differ.</p>
        </div>
      ) : null}

      <div className="grid gap-4" aria-live="polite">
        {grouped.map((group) => {
          const entity = group[0];
          const conflictCount = group.filter((row) => row.kind === "CONFLICT").length;
          return (
            <article className="adm-merge-group" key={groupKey(entity)}>
              <header className="adm-merge-group__header">
                <div>
                  <div className="adm-merge-group__identity">
                    <span>{entityTypeLabel(entity.rootEntityType)}</span>
                    <span aria-hidden="true">·</span>
                    <span>{localeLabel(entity.locale)}</span>
                  </div>
                  <h2>{entity.entityLabel}</h2>
                  <p>
                    {group.length} field{group.length === 1 ? "" : "s"} differ
                    {conflictCount > 0 ? ` · ${conflictCount} need${conflictCount === 1 ? "s" : ""} a decision` : ""}
                  </p>
                </div>
                <Link href={entity.href} className="adm-btn-ghost">Open editor</Link>
              </header>

              <div className="adm-merge-fields">
                {group.map((difference) => {
                  const copy = kindCopy(difference.kind);
                  const KindIcon = copy.icon;
                  return (
                    <section className="adm-merge-field" key={difference.id} data-kind={difference.kind.toLowerCase()}>
                      <div className="adm-merge-field__heading">
                        <div>
                          <h3>{difference.fieldLabel}</h3>
                          <p>{difference.targetKind === "METAOBJECT" ? "Extended content" : "Shopify field"}</p>
                        </div>
                        <div className="adm-merge-kind">
                          <KindIcon size={14} aria-hidden="true" />
                          <span>{copy.label}</span>
                        </div>
                      </div>
                      <p className="adm-merge-field__hint">{copy.hint}</p>

                      <div className="adm-merge-compare" aria-label={`${difference.fieldLabel} comparison`}>
                        <div data-changed={difference.kind !== "SHOPIFY_ONLY" ? "true" : undefined}>
                          <h4>Synarava</h4>
                          <ValuePreview value={difference.localValue} />
                        </div>
                        <div data-changed={difference.kind !== "LOCAL_ONLY" ? "true" : undefined}>
                          <h4>Shopify</h4>
                          <ValuePreview value={difference.shopifyValue} />
                        </div>
                      </div>

                      {difference.baseValue !== null ? (
                        <details className="adm-merge-base">
                          <summary>Show last synced value</summary>
                          <ValuePreview value={difference.baseValue} />
                        </details>
                      ) : (
                        <p className="adm-merge-first-sync">No previous synced version — this is the first comparison.</p>
                      )}

                      <fieldset className="adm-merge-choice">
                        <legend>Choose the version to keep</legend>
                        <button
                          type="button"
                          aria-pressed={choices[difference.id] === "SYNARAVA"}
                          data-selected={choices[difference.id] === "SYNARAVA" ? "true" : undefined}
                          onClick={() => choose(difference.id, "SYNARAVA")}
                        >
                          <span>Keep Synarava</span>
                          <small>{isEmptyValue(difference.localValue) ? "This will clear Shopify" : "Update Shopify with this value"}</small>
                        </button>
                        <button
                          type="button"
                          aria-pressed={choices[difference.id] === "SHOPIFY"}
                          data-selected={choices[difference.id] === "SHOPIFY" ? "true" : undefined}
                          onClick={() => choose(difference.id, "SHOPIFY")}
                        >
                          <span>Use Shopify</span>
                          <small>{isEmptyValue(difference.shopifyValue) ? "This will clear Synarava" : "Update Synarava with this value"}</small>
                        </button>
                      </fieldset>
                    </section>
                  );
                })}
              </div>
            </article>
          );
        })}

        {differences.length > 0 && grouped.length === 0 ? (
          <div className="adm-sync-empty">
            <h2>No changes in this view</h2>
            <p>Choose another filter to review the remaining differences.</p>
          </div>
        ) : null}

        {differences.length === 0 && initialRun?.status === "SUCCEEDED" ? (
          <div className="adm-sync-empty" data-positive="true">
            <Check size={20} aria-hidden="true" />
            <h2>No review needed</h2>
            <p>Every supported translated field matched at the last check.</p>
          </div>
        ) : null}
      </div>

      {selected.length > 0 ? (
        <aside className="adm-apply-review" aria-label="Review selected sync changes">
          <div className="adm-apply-review__heading">
            <div>
              <h2>Review {selected.length} selected change{selected.length === 1 ? "" : "s"}</h2>
              <p>
                {shopifyWriteCount > 0 ? `${shopifyWriteCount} will update Shopify. ` : ""}
                {localWriteCount > 0 ? `${localWriteCount} will update Synarava. ` : ""}
                Unselected fields stay untouched.
              </p>
            </div>
            <button
              type="button"
              className="adm-btn-primary"
              disabled={applying
                || (clearCount > 0 && !acknowledgedClears)
                || (selected.length > 1 && !acknowledgedBatch)}
              onClick={() => void applyChoices()}
            >
              {applying ? <RefreshCw size={15} className="animate-spin" aria-hidden="true" /> : <Check size={15} aria-hidden="true" />}
              {applying ? "Applying…" : "Apply selected"}
            </button>
          </div>

          <ul className="adm-apply-review__list">
            {selected.map(({ difference, choice }) => (
              <li key={difference.id}>
                <span>{difference.entityLabel} · {difference.fieldLabel}</span>
                <strong>{choice === "SYNARAVA" ? "Synarava → Shopify" : "Shopify → Synarava"}</strong>
              </li>
            ))}
          </ul>

          {clearCount > 0 ? (
            <label className="adm-apply-review__clear">
              <input type="checkbox" checked={acknowledgedClears} onChange={(event) => setAcknowledgedClears(event.target.checked)} />
              <span>I understand that {clearCount} selected value{clearCount === 1 ? "" : "s"} will be cleared.</span>
            </label>
          ) : null}
          {selected.length > 1 ? (
            <label className="adm-apply-review__confirm">
              <input type="checkbox" checked={acknowledgedBatch} onChange={(event) => setAcknowledgedBatch(event.target.checked)} />
              <span>I reviewed all {selected.length} selected changes and their destinations.</span>
            </label>
          ) : null}
        </aside>
      ) : null}

      {applyMessage ? <p className="adm-apply-message" role="status">{applyMessage}</p> : null}
    </section>
  );
}
