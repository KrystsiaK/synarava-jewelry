"use client";

import { useState, useTransition } from "react";

import {
  saveCommerceCopyAction,
  type CommerceCopyActionState,
} from "@/app/admin/actions/commerce-copy";
import { useAdminToast } from "@/components/admin/shared/admin-toast";
import {
  AdminLocaleTabs,
  useAdminActiveLocale,
  type AdminLocaleStatus,
  type AdminLocaleTab,
} from "@/components/admin/shared/admin-locale-workspace";
import { AuthMessage } from "@/components/auth/auth-form-primitives";
import { AdminLongTextField, AdminTextField } from "@/components/synarava-cms";
import { COMMERCE_COPY_GROUPS } from "@/lib/content/commerce-copy-fields";
import type { LocaleCopy } from "@/lib/content/commerce-copy-fields";

export function CommerceCopyEditor({
  copy,
  defaults,
  locales,
}: {
  copy: LocaleCopy;
  defaults: LocaleCopy;
  locales: AdminLocaleTab[];
}) {
  const [state, setState] = useState<CommerceCopyActionState>({});
  const [isPending, startTransition] = useTransition();
  const { pushToast } = useAdminToast();
  const [activeLocale, selectLocale] = useAdminActiveLocale("commerce-copy", locales, locales[0]?.code ?? "en");
  const englishDefaults = defaults.en ?? {};
  const status: AdminLocaleStatus = "NOT_APPLICABLE";

  function formAction(formData: FormData) {
    startTransition(async () => {
      const result = await saveCommerceCopyAction(formData);
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
        ptStatus={status}
      />
      <AuthMessage error={state.error} />
      <nav className="flex flex-wrap gap-2 text-xs" aria-label="Jump to section">
        {COMMERCE_COPY_GROUPS.map((group) => (
          <a
            key={group.id}
            href={`#commerce-${group.id}`}
            className="underline-offset-2 hover:underline"
            style={{ color: "var(--adm-muted)" }}
          >
            {group.title}
          </a>
        ))}
      </nav>

      {COMMERCE_COPY_GROUPS.map((group) => (
        <section key={group.id} id={`commerce-${group.id}`} className="adm-panel grid gap-4 p-5 md:p-6 scroll-mt-24">
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
          {isPending ? "Saving..." : "Save cart & account"}
        </button>
      </div>
    </form>
  );
}
