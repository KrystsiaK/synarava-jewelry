"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";

import {
  scanAdminIssuesAction,
  type AdminIssueScanState,
} from "@/app/admin/issues/actions";
import type { AdminIssueSummary } from "@/components/admin/admin-issue-types";
import { useAdminToast } from "@/components/admin/admin-toast";
import { AuthMessage } from "@/components/auth/auth-form-primitives";

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function issueTone(issue: AdminIssueSummary) {
  if (issue.status === "RESOLVED") return "var(--adm-muted)";
  return issue.severity === "ERROR" ? "var(--adm-danger)" : "var(--adm-accent)";
}

export function AdminIssueInlineWarning({
  issues,
  className = "",
}: {
  issues: AdminIssueSummary[];
  className?: string;
}) {
  if (issues.length === 0) return null;

  return (
    <div
      className={`grid gap-2 p-3 text-xs ${className}`}
      style={{
        border: "1px solid rgba(255, 93, 93, 0.38)",
        background: "rgba(255, 93, 93, 0.08)",
        color: "var(--adm-danger)",
        borderRadius: "8px",
      }}
    >
      {issues.map((issue) => (
        <Link
          key={issue.id}
          href={issue.targetHref}
          className="flex items-start gap-2 font-bold uppercase tracking-[0.08em]"
        >
          <AlertTriangle size={14} strokeWidth={1.8} className="mt-0.5 shrink-0" />
          <span>{issue.title}</span>
        </Link>
      ))}
    </div>
  );
}

export function AdminIssuesCms({ issues }: { issues: AdminIssueSummary[] }) {
  const [state, setState] = useState<AdminIssueScanState>({});
  const [isPending, startTransition] = useTransition();
  const openIssues = issues.filter((issue) => issue.status === "OPEN");
  const resolvedIssues = issues.filter((issue) => issue.status !== "OPEN");
  const { pushToast } = useAdminToast();

  function runScan() {
    startTransition(async () => {
      const result = await scanAdminIssuesAction();
      setState(result);
      if (result.error) pushToast({ message: result.error, tone: "error" });
      if (result.success) pushToast({ message: result.success, tone: "success" });
    });
  }

  return (
    <section className="adm-panel grid gap-5 p-5">
      <div
        className="flex flex-col gap-4 pb-4 md:flex-row md:items-end md:justify-between"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div>
          <p className="adm-section-tag">[ QA // PROBLEMS ]</p>
          <h2 className="adm-title-sm mt-2">Problems table</h2>
          <p className="mt-1 text-xs" style={{ color: "var(--adm-muted)" }}>
            {openIssues.length} open · {resolvedIssues.length} resolved or ignored
          </p>
        </div>
        <button
          type="button"
          className="adm-btn-primary inline-flex items-center justify-center gap-2"
          onClick={runScan}
          disabled={isPending}
        >
          <RefreshCw size={15} strokeWidth={1.8} className={isPending ? "animate-spin" : ""} />
          {isPending ? "Scanning..." : "Scan now"}
        </button>
      </div>

      <AuthMessage error={state.error} />

      <div className="grid gap-2">
        {issues.length > 0 ? (
          issues.map((issue) => (
            <div
              key={issue.id}
              className="grid gap-3 p-3 lg:grid-cols-[8rem_minmax(0,1fr)_12rem_12rem] lg:items-center"
              style={{
                border: "1px solid rgba(255,255,255,0.06)",
                background:
                  issue.status === "OPEN" ? "rgba(255, 93, 93, 0.055)" : "transparent",
              }}
            >
              <div>
                <p
                  className="text-[0.64rem] font-bold uppercase tracking-[0.1em]"
                  style={{ color: issueTone(issue) }}
                >
                  {issue.status} / {issue.severity}
                </p>
                <p className="mt-1 text-xs" style={{ color: "var(--adm-muted)" }}>
                  {issue.issueType}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold" style={{ color: "var(--adm-ink)" }}>
                  {issue.title}
                </p>
                <p className="mt-1 break-words text-xs leading-5" style={{ color: "var(--adm-muted)" }}>
                  {issue.description}
                </p>
                <p className="mt-1 text-xs" style={{ color: "var(--adm-muted)" }}>
                  {issue.entityType}: {issue.entityLabel}
                </p>
              </div>
              <div className="text-xs leading-5" style={{ color: "var(--adm-muted)" }}>
                <p>First: {formatDate(issue.firstSeenAt)}</p>
                <p>Last: {formatDate(issue.lastSeenAt)}</p>
              </div>
              <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
                <Link href={issue.targetHref} className="adm-btn-primary py-1 px-2 text-[0.58rem]">
                  Open problem
                </Link>
              </div>
            </div>
          ))
        ) : (
          <p className="adm-copy py-6">
            No problems are recorded yet. Run the scan to check media and taxonomy.
          </p>
        )}
      </div>
    </section>
  );
}
