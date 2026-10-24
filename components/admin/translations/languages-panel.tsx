"use client";

import { useMemo, useState, useTransition } from "react";
import { Download, Upload, X } from "lucide-react";

import {
  addLanguageAction,
  deleteLanguageDataAction,
  exportLanguageAction,
  hideLanguageAction,
  importLanguageAction,
  previewImportLanguageAction,
  restoreLanguageAction,
} from "@/app/admin/actions/languages";
import { AdminButton, AdminCheckboxControl, AdminTextField } from "@/components/synarava-cms";
import { AnimatedModal } from "@/components/ui/animated-modal";
import type { LanguageBundle, LanguageBundleImportPreview } from "@/lib/i18n/language-bundle";
import {
  LOCALE_DELETE_RETENTION_DAYS,
  localeLifecycleState,
  retentionDaysElapsed,
} from "@/lib/i18n/storefront-locale-status";
import type { StorefrontLocaleRecord } from "@/lib/i18n/storefront-locale-registry";

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
  const [exportChecksums, setExportChecksums] = useState<Record<string, string>>({});
  const [typedCodes, setTypedCodes] = useState<Record<string, string>>({});
  const [showRetired, setShowRetired] = useState(false);
  const [importPreview, setImportPreview] = useState<LanguageBundleImportPreview | null>(null);
  const [pendingBundle, setPendingBundle] = useState<LanguageBundle | null>(null);
  const [confirmImport, setConfirmImport] = useState(false);
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

  function closeImportPreview() {
    if (pending) return;
    setImportPreview(null);
    setPendingBundle(null);
    setConfirmImport(false);
  }

  function confirmImportApply() {
    if (!pendingBundle || !importPreview || !confirmImport) return;
    const bundle = pendingBundle;
    startTransition(async () => {
      const result = await importLanguageAction(bundle);
      setMessage(result.error ?? result.success ?? "Import finished.");
      setImportPreview(null);
      setPendingBundle(null);
      setConfirmImport(false);
    });
  }

  return (
    <section className="adm-panel grid gap-4 p-5 md:p-6" data-component="LanguagesPanel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Languages</h2>
          <p className="text-sm text-[var(--adm-muted)]">
            Add, hide, restore, export, or import a language. Adding a language adds its tab
            everywhere in admin. Import always shows a preview before anything is written.
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
            {visible.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-[var(--adm-muted)]">
                  No languages to show. Add one below, or turn on “Show retired”.
                </td>
              </tr>
            ) : null}
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
                        <AdminButton variant="ghost" disabled={pending} onClick={() => run("Hide", () => hideLanguageAction(locale.code))}>
                          Hide
                        </AdminButton>
                      ) : null}
                      {!locale.isDefault && state === "retired" ? (
                        <AdminButton variant="ghost" disabled={pending} onClick={() => run("Restore", () => restoreLanguageAction(locale.code))}>
                          Restore
                        </AdminButton>
                      ) : null}
                      {!locale.isDefault ? (
                        <AdminButton variant="ghost" disabled={pending} onClick={() => run("Export", async () => { const result = await exportLanguageAction(locale.code); downloadBundle(result.bundle); setExportChecksums((current) => ({ ...current, [locale.code]: result.bundle.checksum, })); return { success: `Exported ${locale.code}.` }; }) }>
                          <Download size={14} aria-hidden="true" />
                          Export
                        </AdminButton>
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
                          <AdminButton variant="ghost" disabled={pending || !canDelete} title={ canDelete ? "Delete translation data" : `Export first; retention ${LOCALE_DELETE_RETENTION_DAYS} days` } onClick={() => run("Delete", () => deleteLanguageDataAction({ code: locale.code, typedCode: typedCodes[locale.code] ?? "", exportChecksum: exportChecksums[locale.code] ?? "", })) }>
                            Delete data
                          </AdminButton>
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
        <p className="text-xs text-[var(--adm-muted)]">
          After you add a language, its locale tab appears on products, collections, pages, and settings.
        </p>
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
        <AdminButton variant="primary" className="w-fit" disabled={pending} onClick={() => run("Add", () => addLanguageAction(draft))}>
          Add
        </AdminButton>
      </div>

      <div className="grid gap-2 border-t pt-4" style={{ borderColor: "var(--adm-border)" }}>
        <h3 className="text-sm font-semibold">Import language bundle</h3>
        <p className="text-xs text-[var(--adm-muted)]">
          Choose a JSON export. You will see what differs and must confirm before Synarava is updated.
        </p>
        <label className="adm-btn-ghost inline-flex w-fit cursor-pointer items-center gap-2">
          <Upload size={14} aria-hidden="true" />
          Choose JSON file
          <input
            type="file"
            accept="application/json,.json"
            className="sr-only"
            disabled={pending}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              setMessage(null);
              setConfirmImport(false);
              startTransition(async () => {
                try {
                  const text = await file.text();
                  const bundle = JSON.parse(text) as LanguageBundle;
                  const result = await previewImportLanguageAction(bundle);
                  if (result.error || !result.preview) {
                    setMessage(result.error ?? "Could not build import preview.");
                    return;
                  }
                  setPendingBundle(bundle);
                  setImportPreview(result.preview);
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

      {importPreview ? (
        <AnimatedModal
          open
          onClose={closeImportPreview}
          ariaLabel="Import preview — confirm before writing"
          portalClassName="admin-modal-root"
          zIndexClassName="z-[400]"
          backdropZIndexClassName="z-[390]"
          className="adm-panel pointer-events-auto grid max-h-[min(88vh,40rem)] w-full max-w-3xl grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden p-0"
        >
          <header className="flex items-start justify-between gap-3 border-b border-[var(--adm-border)] p-5">
            <div>
              <p className="adm-section-tag">[ IMPORT PREVIEW — REQUIRED ]</p>
              <h2 className="adm-title-sm mt-2">
                Import
                {" "}
                {importPreview.locale.toUpperCase()}
              </h2>
              <p className="mt-1 text-xs text-[var(--adm-muted)]">
                Nothing is written until you confirm. Review the counts and sample changes below.
              </p>
            </div>
            <AdminButton
              variant="ghost"
              className="grid size-11 place-items-center p-0"
              onClick={closeImportPreview}
              disabled={pending}
              aria-label="Close import preview"
            >
              <X className="size-4" aria-hidden="true" />
            </AdminButton>
          </header>
          <div className="min-h-0 space-y-4 overflow-y-auto p-5">
            <ul className="grid gap-2 text-sm sm:grid-cols-2">
              <li className="rounded-lg border border-[var(--adm-border)] p-3">
                Products: {importPreview.counts.products}
              </li>
              <li className="rounded-lg border border-[var(--adm-border)] p-3">
                Collections: {importPreview.counts.collections}
              </li>
              <li className="rounded-lg border border-[var(--adm-border)] p-3">
                Pages: {importPreview.counts.pages}
              </li>
              <li className="rounded-lg border border-[var(--adm-border)] p-3">
                Redirects: {importPreview.counts.redirects}
              </li>
              <li className="rounded-lg border border-[var(--adm-border)] p-3 sm:col-span-2">
                Fields that differ: {importPreview.counts.fieldsChanged}
                {" · "}
                New rows: {importPreview.counts.fieldsCreated}
              </li>
            </ul>
            {importPreview.samples.length === 0 ? (
              <p className="text-sm text-[var(--adm-muted)]" role="status">
                No field values differ from what is stored today. You can still confirm to re-apply the bundle.
              </p>
            ) : (
              <div className="grid gap-3">
                <h3 className="text-sm font-semibold">Sample changes</h3>
                {importPreview.samples.map((sample) => (
                  <article
                    key={`${sample.entityType}:${sample.entityId}:${sample.fieldKey}:${sample.label}`}
                    className="rounded-lg border border-[var(--adm-border)] p-3 text-sm"
                  >
                    <p className="font-semibold">
                      {sample.entityType}
                      {" · "}
                      {sample.label}
                    </p>
                    <p className="mt-2 text-xs text-[var(--adm-muted)]">
                      Now:
                      {" "}
                      {sample.before || "— empty —"}
                    </p>
                    <p className="mt-1 text-xs">
                      After import:
                      {" "}
                      {sample.after || "— empty —"}
                    </p>
                  </article>
                ))}
                {importPreview.counts.fieldsChanged > importPreview.samples.length ? (
                  <p className="text-xs text-[var(--adm-muted)]">
                    Showing {importPreview.samples.length} of {importPreview.counts.fieldsChanged} field changes.
                  </p>
                ) : null}
              </div>
            )}
            <AdminCheckboxControl
              className="max-w-xl text-xs"
              checked={confirmImport}
              onChange={(event) => setConfirmImport(event.target.checked)}
              label="I reviewed this preview and want to update Synarava with this import."
              labelClassName="text-xs leading-5"
            />
          </div>
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--adm-border)] bg-[var(--adm-panel)] p-4">
            <AdminButton variant="secondary" onClick={closeImportPreview} disabled={pending}>
              Cancel
            </AdminButton>
            <AdminButton
              variant="primary"
              onClick={confirmImportApply}
              disabled={pending || !confirmImport}
            >
              {pending ? "Importing…" : "Confirm import"}
            </AdminButton>
          </footer>
        </AnimatedModal>
      ) : null}
    </section>
  );
}
