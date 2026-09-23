"use client";

import { useState, useTransition } from "react";

import {
  saveStorefrontCopyAction,
  type StorefrontCopyActionState,
} from "@/app/admin/actions/storefront-copy";
import { useAdminToast } from "@/components/admin/shared/admin-toast";
import { AdminLocaleTabs, useAdminActiveLocale, type AdminLocaleStatus, type AdminLocaleTab } from "@/components/admin/shared/admin-locale-workspace";
import { AuthMessage } from "@/components/auth/auth-form-primitives";
import { AdminHelp, AdminLongTextField, AdminTextField } from "@/components/synarava-cms";
import { STOREFRONT_COPY_GROUPS } from "@/lib/content/storefront-copy-fields";
import type { StorefrontCopy } from "@/lib/content/storefront-copy";

const SECTION_JUMPS = [
  { href: "#copy-header-main", label: "Header" },
  { href: "#copy-footer-brand", label: "Footer" },
] as const;

export function StorefrontCopyEditor({
  copy,
  defaults,
  locales,
  ptStatus,
}: {
  copy: StorefrontCopy;
  defaults: StorefrontCopy;
  locales: AdminLocaleTab[];
  ptStatus?: AdminLocaleStatus;
}) {
  const [state, setState] = useState<StorefrontCopyActionState>({});
  const [isPending, startTransition] = useTransition();
  const { pushToast } = useAdminToast();
  const [activeLocale, selectLocale] = useAdminActiveLocale("storefront-copy", locales, locales[0]?.code ?? "en");
  const englishDefaults = defaults.en ?? {};

  function formAction(formData: FormData) {
    startTransition(async () => {
      const result = await saveStorefrontCopyAction(formData);
      setState(result);
      if (result.error) pushToast({ message: result.error, tone: "error" });
      if (result.success) pushToast({ message: result.success, tone: "success" });
    });
  }

  return (
    <form action={formAction} className="grid gap-8">
      <AdminLocaleTabs
        active={activeLocale}
        onSelect={selectLocale}
        locales={locales}
        ptStatus={ptStatus}
      />
      <AuthMessage error={state.error} />
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-xs leading-5" style={{ color: "var(--adm-muted)" }}>
          Leave a field empty to fall back to the shipped default (shown as placeholder). Labels only — destinations stay fixed.
        </p>
        <nav className="flex gap-2 text-xs" aria-label="Jump to section">
          {SECTION_JUMPS.map((jump) => (
            <a
              key={jump.href}
              href={jump.href}
              className="underline-offset-2 hover:underline"
              style={{ color: "var(--adm-muted)" }}
            >
              {jump.label}
            </a>
          ))}
        </nav>
      </div>

      {STOREFRONT_COPY_GROUPS.map((group) => (
        <section key={group.id} id={`copy-${group.id}`} className="adm-panel grid gap-4 p-5 md:p-6 scroll-mt-24">
          <div>
            <p className="adm-section-tag">{group.title}</p>
            {group.description ? (
              <p className="mt-1 text-xs" style={{ color: "var(--adm-muted)" }}>{group.description}</p>
            ) : null}
          </div>
          <div className="grid gap-4">
            {group.fields.map((field) => (
              <div key={field.key} className="grid gap-2 md:grid-cols-2">
                {locales.map((locale) => {
                  const localeLabel = `${field.label} (${locale.code.toUpperCase()})`;
                  const hidden = activeLocale !== locale.code;
                  const name = `${locale.code}:${field.key}`;
                  const defaultValue = copy[locale.code]?.[field.key] ?? "";
                  const placeholder = defaults[locale.code]?.[field.key] ?? englishDefaults[field.key] ?? "";

                  if (field.area) {
                    return (
                      <div key={locale.code} hidden={hidden}>
                        <AdminLongTextField
                          label={localeLabel}
                          help={field.hint}
                          name={name}
                          defaultValue={defaultValue}
                          placeholder={placeholder}
                          rows={3}
                        />
                      </div>
                    );
                  }

                  return (
                    <div key={locale.code} hidden={hidden}>
                      <AdminTextField
                        label={localeLabel}
                        help={field.hint}
                        name={name}
                        defaultValue={defaultValue}
                        placeholder={placeholder}
                      />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </section>
      ))}

      <div className="flex justify-end" style={{ borderTop: "1px solid var(--adm-border)", paddingTop: "1rem" }}>
        <button type="submit" className="adm-btn-primary" disabled={isPending}>
          {isPending ? "Saving..." : "Save Header & Footer"}
        </button>
      </div>
    </form>
  );
}
