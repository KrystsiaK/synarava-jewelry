"use client";

import { RefreshCw } from "lucide-react";
import { useState, useTransition } from "react";

import { syncStorefrontLocalesAction } from "@/app/admin/actions/translation-sync";
import type { StorefrontLocaleRecord } from "@/lib/i18n/storefront-locale-registry";

export function LocaleRegistryPanel({
  locales,
  duplicateSegments,
  sourceViolation,
}: {
  locales: StorefrontLocaleRecord[];
  duplicateSegments: string[];
  sourceViolation: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function checkNow() {
    setMessage(null);
    startTransition(async () => {
      const result = await syncStorefrontLocalesAction();
      setMessage(result.error ?? result.success ?? null);
    });
  }

  return (
    <section className="adm-panel grid gap-4 p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Storefront locales</h2>
          <p className="text-sm text-[var(--adm-muted)]">
            Publication state comes from Shopify Markets. Route segments are set here and never overwritten by a check.
          </p>
        </div>
        <button type="button" className="adm-btn-ghost" onClick={checkNow} disabled={pending}>
          <RefreshCw size={14} className={pending ? "animate-spin" : undefined} aria-hidden="true" />
          {pending ? "Checking…" : "Check Shopify"}
        </button>
      </div>

      {sourceViolation ? (
        <p role="alert" className="text-sm font-medium" style={{ color: "var(--adm-danger)" }}>{sourceViolation}</p>
      ) : null}
      {duplicateSegments.length > 0 ? (
        <p role="alert" className="text-sm font-medium" style={{ color: "var(--adm-danger)" }}>
          Route segment conflict: {duplicateSegments.join(", ")}
        </p>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--adm-border)]">
              <th className="py-2">Code</th>
              <th>Route</th>
              <th>Shopify locale</th>
              <th>Published</th>
              <th>Last checked</th>
            </tr>
          </thead>
          <tbody>
            {locales.map((locale) => (
              <tr key={locale.id} className="border-b border-[var(--adm-border)]">
                <td className="py-2">{locale.code}{locale.isDefault ? " (source)" : ""}</td>
                <td>/{locale.routeSegment}</td>
                <td>{locale.shopifyLocale}</td>
                <td style={{ color: locale.isPublished ? "var(--adm-success)" : "var(--adm-muted)" }}>
                  {locale.isPublished ? "Published" : "Not published"}
                </td>
                <td>{locale.shopifyUpdatedAt ? new Date(locale.shopifyUpdatedAt).toLocaleString("en") : "Never"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {message ? <p className="adm-apply-message" role="status">{message}</p> : null}
    </section>
  );
}
