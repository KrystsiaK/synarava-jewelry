"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";

import {
  retryTranslationSyncAction,
  type TranslationOverviewEntity,
} from "@/app/admin/actions/translation-sync";
import { useAdminToast } from "@/components/admin/shared/admin-toast";

export type TranslationOverviewStatus = "MISSING" | "PENDING" | "SYNCED" | "FAILED" | "CONFLICT" | "NOT_APPLICABLE";

export type TranslationOverviewRow = {
  id: string;
  entityType: TranslationOverviewEntity;
  entityId: string;
  label: string;
  locale: "PT";
  status: TranslationOverviewStatus;
  href: string;
  error: string | null;
  updatedAt: string | null;
  actor: string | null;
  direction: "PUSH" | "PULL" | "RECONCILE" | null;
};

const FILTERS: Array<TranslationOverviewStatus | "ALL"> = ["ALL", "MISSING", "PENDING", "FAILED", "CONFLICT", "SYNCED"];

function statusClass(status: TranslationOverviewStatus) {
  if (status === "SYNCED") return "adm-badge-published";
  if (status === "FAILED" || status === "CONFLICT") return "adm-badge-error";
  return "adm-badge-draft";
}

export function TranslationsCms({ rows }: { rows: TranslationOverviewRow[] }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("ALL");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { pushToast } = useAdminToast();
  const router = useRouter();
  const visible = useMemo(
    () => filter === "ALL" ? rows : rows.filter((row) => row.status === filter),
    [filter, rows],
  );

  function retry(row: TranslationOverviewRow) {
    setPendingId(row.id);
    startTransition(async () => {
      const result = await retryTranslationSyncAction(row.entityType, row.entityId);
      setPendingId(null);
      if (result.error) pushToast({ message: result.error, tone: "error" });
      else {
        pushToast({ message: result.success ?? "Translation synced.", tone: "success" });
        router.refresh();
      }
    });
  }

  return (
    <section className="adm-panel grid gap-5 p-5" data-component="TranslationsCms">
      <div className="flex flex-col gap-4 border-b pb-4 md:flex-row md:items-end md:justify-between" style={{ borderColor: "var(--adm-border)" }}>
        <div>
          <p className="adm-section-tag">[ I18N // SHOPIFY ]</p>
          <h2 className="adm-title-sm mt-2">Translation status</h2>
          <p className="mt-1 text-xs" style={{ color: "var(--adm-muted)" }}>{rows.length} Portuguese resources</p>
        </div>
        <label className="grid gap-1">
          <span className="adm-label">Status</span>
          <select className="adm-field min-w-40" value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}>
            {FILTERS.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}
          </select>
        </label>
      </div>

      <div className="grid gap-2" aria-live="polite">
        {visible.map((row) => {
          const retryable = row.status === "FAILED" || row.status === "PENDING" || row.status === "MISSING";
          return (
            <article key={row.id} className="grid gap-3 border p-3 lg:grid-cols-[8rem_minmax(0,1fr)_15rem_10rem] lg:items-center" style={{ borderColor: "var(--adm-border)" }}>
              <div>
                <span className={statusClass(row.status)}>{row.status}</span>
                <p className="mt-2 text-[0.62rem] uppercase tracking-[0.08em]" style={{ color: "var(--adm-muted)" }}>{row.entityType} · {row.locale}</p>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold">{row.label}</p>
                {row.error ? <p className="mt-1 text-xs" style={{ color: "var(--adm-danger)" }}>{row.error}</p> : null}
                <p className="mt-1 text-xs" style={{ color: "var(--adm-muted)" }}>
                  {row.direction ?? "—"} · {row.actor ?? "system"} · {row.updatedAt ? new Date(row.updatedAt).toLocaleString("en") : "never synced"}
                </p>
              </div>
              <Link className="text-xs underline underline-offset-4" href={row.href}>
                {row.status === "CONFLICT" ? "Resolve conflict" : "Open editor"}
              </Link>
              <div className="flex justify-end">
                {retryable ? (
                  <button type="button" className="adm-btn-primary inline-flex items-center gap-2" disabled={isPending} onClick={() => retry(row)}>
                    <RefreshCw size={14} className={pendingId === row.id ? "animate-spin" : ""} /> Retry
                  </button>
                ) : null}
              </div>
            </article>
          );
        })}
        {visible.length === 0 ? <p className="adm-copy py-6">No translations match this filter.</p> : null}
      </div>
    </section>
  );
}
