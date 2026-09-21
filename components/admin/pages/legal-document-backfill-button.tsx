"use client";

import { useState, useTransition } from "react";

import { backfillLegalDocumentDefaultsAction } from "@/app/admin/actions/legal-document-backfill";
import { useAdminToast } from "@/components/admin/shared/admin-toast";

// One-time maintenance tool: copies shipped default copy into any Legal
// Document field (Privacy, Terms & Conditions, Legal Notice, Public Offer
// Agreement) that has never held real admin-saved content. Safe to click
// more than once — it only ever fills gaps, never overwrites existing text.
export function LegalDocumentBackfillButton() {
  const [isPending, startTransition] = useTransition();
  const [summary, setSummary] = useState<string[] | null>(null);
  const { pushToast } = useAdminToast();

  function run() {
    startTransition(async () => {
      const result = await backfillLegalDocumentDefaultsAction();
      setSummary(result.summary ?? null);
      if (result.error) pushToast({ message: result.error, tone: "error" });
      if (result.success) pushToast({ message: result.success, tone: "success" });
    });
  }

  return (
    <div className="adm-panel grid gap-3 p-4">
      <div>
        <p className="adm-section-tag">[ MAINTENANCE ]</p>
        <h3 className="adm-title-sm mt-1">Legal document initial content</h3>
        <p className="mt-1 text-xs leading-5" style={{ color: "var(--adm-muted)" }}>
          Fills in the shipped default text for any Privacy Policy, Terms & Conditions, Legal Notice, or
          Public Offer Agreement field that has never been saved with real content. Never changes a field
          that already has one — safe to run more than once.
        </p>
      </div>
      <button type="button" className="adm-btn-ghost w-fit" disabled={isPending} onClick={run}>
        {isPending ? "Running…" : "Run backfill"}
      </button>
      {summary ? (
        <ul className="grid gap-1 text-xs" style={{ color: "var(--adm-muted)" }}>
          {summary.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
