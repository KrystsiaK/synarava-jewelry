"use client";

import { useMemo, useState, useTransition } from "react";
import { Download, RefreshCw, Upload } from "lucide-react";

import {
  addLanguageAction,
  deleteLanguageDataAction,
  exportLanguageAction,
  hideLanguageAction,
  importLanguageAction,
  restoreLanguageAction,
} from "@/app/admin/actions/languages";
import { syncStorefrontLocalesAction } from "@/app/admin/actions/translation-sync";
import { AdminTextField } from "@/components/synarava-cms";
import type { LanguageBundle } from "@/lib/i18n/language-bundle";
import {
  LOCALE_DELETE_RETENTION_DAYS,
  localeLifecycleState,
  retentionDaysElapsed,
} from "@/lib/i18n/storefront-locale-status";
import type { StorefrontLocaleRecord } from "@/lib/i18n/storefront-locale-registry";
import type { ShopifyShopLocale } from "@/lib/shopify/admin";

function downloadBundle(bundle: LanguageBundle) {
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `synarava-language-${bundle.locale}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function LanguagesPanel({
  locales,
  duplicateSegments,
  sourceViolation,
  hasWriteLocales,
}: {
  locales: StorefrontLocaleRecord[];
  duplicateSegments: string[];
  sourceViolation: string | null;
  hasWriteLocales: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [unmatched, setUnmatched] = useState<ShopifyShopLocale[]>([]);
  const [exportChecksums, setExportChecksums] = useState<Record<string, string>>({});
  const [typedCodes, setTypedCodes] = useState<Record<string, string>>({});
  const [showRetired, setShowRetired] = useState(false);
  const [draft, setDraft] = useState({
    code: "",
    routeSegment: "",
    shopifyLocale: "",
    intlLocale: "",
    name: "",
    nativeName: "",
  });

  const visible = useMemo(
    () =>
      locales.filter((locale) => {
        const state = localeLifecycleState(locale);
        if (state === "deleted") return showRetired;
        if (state === "retired") return showRetired;
        return true;
      }),
    [locales, showRetired],
  );

  function run(label: string, action: () => Promise<{ success?: string; error?: string; requiresWriteLocales?: boolean }>) {
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      const parts = [result.error, result.success].filter(Boolean);
      if (result.requiresWriteLocales && !hasWriteLocales) {
        parts.push("Shopify write_locales scope is missing — language Shopify writes stay read-only.");
      }
      setMessage(parts.join(" ") || `${label} done.`);
    });
  }

  function checkShopify() {
    setMessage(null);
    startTransition(async () => {
      const result = await syncStorefrontLocalesAction();
      setMessage(result.error ?? result.success ?? null);
      setUnmatched(result.unmatched ?? []);
    });
  }

  return (
    <section className="adm-panel grid gap-4 p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Languages</h2>
          <p className="text-sm text-[var(--adm-muted)]">
            Add, hide, restore, export, import, and delete storefront languages.
            Draft stays in admin only; Published is live; Retired keeps permanent 301s.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex items-center gap-2 text-sm text-[var(--adm-muted)]">
            <input
              type="checkbox"
              checked={showRetired}
              onChange={(event) => setShowRetired(event.target.checked)}
            />
            Show retired
          </label>
          <button type="button" className="adm-btn-ghost" onClick={checkShopify} disabled={pending}>
            <RefreshCw size={14} className={pending ? "animate-spin" : undefined} aria-hidden="true" />
            {pending ? "Working…" : "Check Shopify"}
          </button>
        </div>
      </div>

      {!hasWriteLocales ? (
        <p role="status" className="text-sm" style={{ color: "var(--adm-warning, #a16207)" }}>
          Read-only for Shopify locale writes until the Synarava Sync app has the
          {" "}
          <code>write_locales</code>
          {" "}
          scope. Local Draft/Retired state still works.
        </p>
      ) : null}

      {sourceViolation ? (
        <p role="alert" className="text-sm font-medium" style={{ color: "var(--adm-danger)" }}>{sourceViolation}</p>
      ) : null}
      {duplicateSegments.length > 0 ? (
        <p role="alert" className="text-sm font-medium" style={{ color: "var(--adm-danger)" }}>
          Route segment conflict: {duplicateSegments.join(", ")}
        </p>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--adm-border)]">
              <th className="py-2">Code</th>
              <th>Route</th>
              <th>State</th>
              <th>Shopify</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((locale) => {
              const state = localeLifecycleState(locale);
              const canDelete =
                state === "retired"
                && retentionDaysElapsed(locale.retiredAt)
                && Boolean(exportChecksums[locale.code]);
              return (
                <tr key={locale.id} className="border-b border-[var(--adm-border)] align-top">
                  <td className="py-2">
                    {locale.code}
                    {locale.isDefault ? " (source)" : ""}
                  </td>
                  <td>/{locale.routeSegment}</td>
                  <td className="capitalize">{state}</td>
                  <td>{locale.shopifyLocale}</td>
                  <td className="py-2">
                    <div className="flex flex-wrap gap-2">
                      {!locale.isDefault && state === "published" ? (
                        <button
                          type="button"
                          className="adm-btn-ghost"
                          disabled={pending}
                          onClick={() => run("Hide", () => hideLanguageAction(locale.code))}
                        >
                          Hide
                        </button>
                      ) : null}
                      {!locale.isDefault && state === "retired" ? (
                        <button
                          type="button"
                          className="adm-btn-ghost"
                          disabled={pending}
                          onClick={() => run("Restore", () => restoreLanguageAction(locale.code))}
                        >
                          Restore
                        </button>
                      ) : null}
                      {!locale.isDefault ? (
                        <button
                          type="button"
                          className="adm-btn-ghost"
                          disabled={pending}
                          onClick={() =>
                            run("Export", async () => {
                              const result = await exportLanguageAction(locale.code);
                              downloadBundle(result.bundle);
                              setExportChecksums((current) => ({
                                ...current,
                                [locale.code]: result.bundle.checksum,
                              }));
                              return { success: `Exported ${locale.code}.` };
                            })
                          }
                        >
                          <Download size={14} aria-hidden="true" />
                          Export
                        </button>
                      ) : null}
                      {!locale.isDefault && state === "retired" ? (
                        <div className="grid min-w-[12rem] gap-1">
                          <input
                            className="adm-input"
                            placeholder={`Type ${locale.code} to delete`}
                            value={typedCodes[locale.code] ?? ""}
                            onChange={(event) =>
                              setTypedCodes((current) => ({
                                ...current,
                                [locale.code]: event.target.value,
                              }))
                            }
                          />
                          <button
                            type="button"
                            className="adm-btn-ghost"
                            disabled={pending || !canDelete}
                            title={
                              canDelete
                                ? "Delete translation data"
                                : `Export first; retention ${LOCALE_DELETE_RETENTION_DAYS} days`
                            }
                            onClick={() =>
                              run("Delete", () =>
                                deleteLanguageDataAction({
                                  code: locale.code,
                                  typedCode: typedCodes[locale.code] ?? "",
                                  exportChecksum: exportChecksums[locale.code] ?? "",
                                }))
                            }
                          >
                            Delete data
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 border-t pt-4" style={{ borderColor: "var(--adm-border)" }}>
        <h3 className="text-sm font-semibold">Add language</h3>
        <div className="grid gap-3 md:grid-cols-3">
          <AdminTextField
            label="Code"
            value={draft.code}
            onChange={(event) => {
              const value = event.target.value;
              setDraft((current) => ({
                ...current,
                code: value,
                routeSegment: current.routeSegment || value,
                shopifyLocale: current.shopifyLocale || value,
                intlLocale: current.intlLocale || value,
              }));
            }}
          />
          <AdminTextField
            label="Route segment"
            value={draft.routeSegment}
            onChange={(event) => setDraft((current) => ({ ...current, routeSegment: event.target.value }))}
          />
          <AdminTextField
            label="Shopify locale"
            value={draft.shopifyLocale}
            onChange={(event) => setDraft((current) => ({ ...current, shopifyLocale: event.target.value }))}
          />
          <AdminTextField
            label="Intl locale"
            value={draft.intlLocale}
            onChange={(event) => setDraft((current) => ({ ...current, intlLocale: event.target.value }))}
          />
          <AdminTextField
            label="Name"
            value={draft.name}
            onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
          />
          <AdminTextField
            label="Native name"
            value={draft.nativeName}
            onChange={(event) => setDraft((current) => ({ ...current, nativeName: event.target.value }))}
          />
        </div>
        <button
          type="button"
          className="adm-btn-primary w-fit"
          disabled={pending}
          onClick={() => run("Add", () => addLanguageAction(draft))}
        >
          Add
        </button>
      </div>

      <div className="grid gap-2 border-t pt-4" style={{ borderColor: "var(--adm-border)" }}>
        <h3 className="text-sm font-semibold">Import language bundle</h3>
        <label className="adm-btn-ghost inline-flex w-fit cursor-pointer items-center gap-2">
          <Upload size={14} aria-hidden="true" />
          Choose JSON file
          <input
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              setMessage(null);
              startTransition(async () => {
                try {
                  const text = await file.text();
                  const bundle = JSON.parse(text) as LanguageBundle;
                  const result = await importLanguageAction(bundle);
                  setMessage(result.error ?? result.success ?? "Import finished.");
                } catch (error) {
                  setMessage(error instanceof Error ? error.message : String(error));
                }
              });
              event.target.value = "";
            }}
          />
        </label>
      </div>

      {message ? <p className="adm-apply-message" role="status">{message}</p> : null}

      {unmatched.length > 0 ? (
        <div className="grid gap-2 border-t pt-4" style={{ borderColor: "var(--adm-border)" }}>
          <p className="text-sm font-medium">Published in Shopify, not yet in the registry:</p>
          <ul className="grid gap-1 text-sm">
            {unmatched.map((locale) => (
              <li key={locale.locale}>
                <code>{locale.locale}</code>
                {" "}
                —
                {locale.name}
                {" "}
                (
                {locale.published ? "published" : "not published"}
                ).
                Add a route segment for it before it can go live.
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
