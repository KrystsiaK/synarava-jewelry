"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  getAdminRecordHistoryAction,
  restoreAdminRecordVersionAction,
  type AdminAuditEntityType,
  type AdminRecordHistoryItem,
} from "@/app/admin/actions";

export type AdminRecordMeta = {
  createdAt: Date | string;
  updatedAt: Date | string;
};

type AdminRecordMetaModalProps = {
  open: boolean;
  title: string;
  subtitle?: string;
  href: string;
  entityType: AdminAuditEntityType;
  entityId: string;
  record: AdminRecordMeta | null;
  onClose: () => void;
};

function formatAdminDate(value: Date | string) {
  return new Intl.DateTimeFormat("en-IE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function AdminRecordDates({ record }: { record: AdminRecordMeta }) {
  return (
    <dl
      className="mt-2 grid gap-1.5 text-xs sm:grid-cols-2 sm:gap-x-4"
      style={{ color: "var(--adm-muted)" }}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <dt className="font-semibold uppercase tracking-[0.08em]">Created</dt>
        <dd className="min-w-0">{formatAdminDate(record.createdAt)}</dd>
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <dt className="font-semibold uppercase tracking-[0.08em]">Updated</dt>
        <dd className="min-w-0">{formatAdminDate(record.updatedAt)}</dd>
      </div>
    </dl>
  );
}

export function AdminRecordMetaModal({
  open,
  title,
  subtitle,
  href,
  entityType,
  entityId,
  record,
  onClose,
}: AdminRecordMetaModalProps) {
  const router = useRouter();
  const [history, setHistory] = useState<AdminRecordHistoryItem[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    startTransition(async () => {
      setMessage("");
      setError("");
      const result = await getAdminRecordHistoryAction({ entityType, entityId });
      if (cancelled) return;

      setHistory(result.history ?? []);
      setError(result.error ?? "");
    });

    return () => {
      cancelled = true;
    };
  }, [entityId, entityType, open]);

  function restoreVersion(auditLogId: string) {
    startTransition(async () => {
      const result = await restoreAdminRecordVersionAction({ entityType, entityId, auditLogId });
      setError(result.error ?? "");
      setMessage(result.success ?? "");

      if (result.success) {
        const refreshed = await getAdminRecordHistoryAction({ entityType, entityId });
        setHistory(refreshed.history ?? []);
        router.refresh();
      }
    });
  }

  if (!open || !record) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center px-6"
      style={{ background: "rgba(5,4,3,0.82)", backdropFilter: "blur(10px)" }}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="adm-panel w-full max-w-lg p-6" role="dialog" aria-modal="true">
        <p className="adm-section-tag mb-3">[ RECORD DETAILS ]</p>
        <h3 className="adm-title-sm">{title}</h3>
        {subtitle ? (
          <p className="mt-1 text-sm" style={{ color: "var(--adm-muted)" }}>
            {subtitle}
          </p>
        ) : null}

        <div
          className="mt-5 grid gap-3 py-4"
          style={{
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            borderTop: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div className="flex items-center justify-between gap-4">
            <span className="adm-label">Created</span>
            <span className="text-sm font-semibold" style={{ color: "var(--adm-ink)" }}>
              {formatAdminDate(record.createdAt)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="adm-label">Updated</span>
            <span className="text-sm font-semibold" style={{ color: "var(--adm-ink)" }}>
              {formatAdminDate(record.updatedAt)}
            </span>
          </div>
        </div>

        <div className="mt-5 grid gap-3">
          <div className="flex items-center justify-between gap-3">
            <p className="adm-label">History</p>
            {isPending ? (
              <span className="text-xs" style={{ color: "var(--adm-muted)" }}>
                Loading...
              </span>
            ) : null}
          </div>

          {error ? <p className="adm-copy text-sm">{error}</p> : null}
          {message ? <p className="adm-copy text-sm">{message}</p> : null}

          {history.length > 0 ? (
            <div className="grid max-h-56 gap-2 overflow-auto pr-1">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-3"
                  style={{ border: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "var(--adm-ink)" }}>
                      {item.action.replace(/_/g, " ").toLowerCase()}
                    </p>
                    <p className="mt-0.5 text-xs" style={{ color: "var(--adm-muted)" }}>
                      {formatAdminDate(item.createdAt)}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="adm-btn-ghost py-1 px-2 text-[0.58rem]"
                    disabled={isPending}
                    onClick={() => restoreVersion(item.id)}
                  >
                    Restore
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="adm-copy text-sm">
              No saved history yet. Future edits, status changes, and restores will appear here.
            </p>
          )}
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button type="button" onClick={onClose} className="adm-btn-ghost">
            Cancel
          </button>
          <Link href={href} className="adm-btn-primary">
            Open editor
          </Link>
        </div>
      </div>
    </div>
  );
}
