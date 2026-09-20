"use client";

import { useState, useTransition } from "react";

import {
  saveStorefrontCopyAction,
  type StorefrontCopyActionState,
} from "@/app/admin/actions/storefront-copy";
import { AdminHelp } from "@/components/admin/shared/admin-help";
import { useAdminToast } from "@/components/admin/shared/admin-toast";
import { AdminLocaleTabs, useAdminActiveLocale, type AdminLocaleStatus } from "@/components/admin/shared/admin-locale-workspace";
import { AuthMessage } from "@/components/auth/auth-form-primitives";
import { STOREFRONT_COPY_GROUPS, STOREFRONT_COPY_KEY } from "@/lib/content/storefront-copy-fields";
import type { StorefrontCopy } from "@/lib/content/storefront-copy";

export function StorefrontCopyEditor({
  copy,
  defaults,
  ptStatus,
}: {
  copy: StorefrontCopy;
  defaults: { en: Record<string, string>; pt: Record<string, string> };
  ptStatus?: AdminLocaleStatus;
}) {
  const [state, setState] = useState<StorefrontCopyActionState>({});
  const [isPending, startTransition] = useTransition();
  const { pushToast } = useAdminToast();
  const [activeLocale, selectLocale] = useAdminActiveLocale("storefront-copy", "EN");

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
        ptStatus={ptStatus}
        syncScope={{ entityType: "STOREFRONT_COPY", entityId: STOREFRONT_COPY_KEY }}
      />
      <AuthMessage error={state.error} />
      <p className="text-xs leading-5" style={{ color: "var(--adm-muted)" }}>
        Leave a field empty to fall back to the shipped default (shown as placeholder text). These
        keys are also used as the English source and Portuguese translation across the site.
      </p>

      {STOREFRONT_COPY_GROUPS.map((group) => (
        <section key={group.id} id={`copy-${group.id}`} className="adm-panel grid gap-4 p-5 md:p-6 scroll-mt-24">
          <div>
            <p className="adm-section-tag">{group.title}</p>
            {group.description ? (
              <p className="mt-1 text-xs" style={{ color: "var(--adm-muted)" }}>{group.description}</p>
            ) : null}
          </div>
          <div className="grid gap-4">
            {group.fields.map((field) => {
              const Field = field.area ? "textarea" : "input";
              return (
                <div key={field.key} className="grid gap-2 md:grid-cols-2">
                  <label className="grid gap-2" hidden={activeLocale !== "EN"}>
                    <span className="adm-label flex items-center gap-1.5">
                      {field.label} (EN)
                      {field.hint ? <AdminHelp>{field.hint}</AdminHelp> : null}
                    </span>
                    <Field
                      name={`en:${field.key}`}
                      defaultValue={copy.en[field.key] ?? ""}
                      placeholder={defaults.en[field.key] ?? ""}
                      rows={field.area ? 3 : undefined}
                      className="adm-field"
                    />
                  </label>
                  <label className="grid gap-2" hidden={activeLocale !== "PT"}>
                    <span className="adm-label flex items-center gap-1.5">
                      {field.label} (PT)
                      {field.hint ? <AdminHelp>{field.hint}</AdminHelp> : null}
                    </span>
                    <Field
                      name={`pt:${field.key}`}
                      defaultValue={copy.pt[field.key] ?? ""}
                      placeholder={defaults.pt[field.key] ?? defaults.en[field.key] ?? ""}
                      rows={field.area ? 3 : undefined}
                      className="adm-field"
                    />
                  </label>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <div className="flex justify-end" style={{ borderTop: "1px solid var(--adm-border)", paddingTop: "1rem" }}>
        <button type="submit" className="adm-btn-primary" disabled={isPending}>
          {isPending ? "Saving..." : "Save site copy"}
        </button>
      </div>
    </form>
  );
}
