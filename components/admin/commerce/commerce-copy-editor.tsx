"use client";

import { useEffect, useState, useTransition } from "react";

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
import { AdminAlert, AdminRichTextField, AdminPanel, AdminSectionTabs, AdminTextField } from "@/components/synarava-cms";
import {
  COMMERCE_COPY_AREAS,
  COMMERCE_COPY_GROUPS,
  commerceAreaForHash,
  type CommerceCopyAreaId,
  type LocaleCopy,
} from "@/lib/content/commerce-copy-fields";
import type { StorefrontCopyGroup } from "@/lib/content/storefront-copy-fields";

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
  const [area, setArea] = useState<CommerceCopyAreaId>("entry");
  const status: AdminLocaleStatus = "NOT_APPLICABLE";
  const englishDefaults = defaults.en ?? {};

  useEffect(() => {
    function syncFromHash() {
      const next = commerceAreaForHash(window.location.hash);
      if (next) setArea(next);
    }
    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, []);

  function selectArea(next: string) {
    const areaId = commerceAreaForHash(next);
    if (!areaId) return;
    setArea(areaId);
    const hash = `#commerce-${areaId}`;
    if (window.location.hash !== hash) {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${hash}`);
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    }
  }

  function formAction(formData: FormData) {
    startTransition(async () => {
      const result = await saveCommerceCopyAction(formData);
      setState(result);
      if (result.error) pushToast({ message: result.error, tone: "error" });
      if (result.success) pushToast({ message: result.success, tone: "success" });
    });
  }

  return (
    <form action={formAction}>
      <AdminAlert message={state.error} />
      <AdminPanel.Root>
        <AdminPanel.Header sticky stickyBand="locale" className="adm-panel__header--ruled">
          <AdminLocaleTabs
            embedded
            active={activeLocale}
            onSelect={selectLocale}
            locales={locales}
            ptStatus={status}
            trailing={
              <button type="submit" className="adm-btn-primary" disabled={isPending}>
                {isPending ? "Saving..." : "Save cart & account"}
              </button>
            }
          />
        </AdminPanel.Header>
        <AdminPanel.Body>
          <AdminSectionTabs
            embedded
            aria-label="Cart & account"
            active={area}
            onChange={selectArea}
            items={COMMERCE_COPY_AREAS.map((item) => ({ id: item.id, label: item.label, detail: item.detail }))}
          >
            <div className="adm-inset-x grid gap-8 py-5">
              {COMMERCE_COPY_GROUPS.map((group) => (
                <div key={group.id} id={`commerce-${group.id}`} hidden={area !== group.id}>
                  <CopyGroup
                    group={group}
                    copy={copy}
                    defaults={defaults}
                    englishDefaults={englishDefaults}
                    locales={locales}
                    activeLocale={activeLocale}
                  />
                </div>
              ))}
            </div>
          </AdminSectionTabs>
        </AdminPanel.Body>
      </AdminPanel.Root>
    </form>
  );
}

function CopyGroup({
  group,
  copy,
  defaults,
  englishDefaults,
  locales,
  activeLocale,
}: {
  group: StorefrontCopyGroup;
  copy: LocaleCopy;
  defaults: LocaleCopy;
  englishDefaults: Record<string, string>;
  locales: AdminLocaleTab[];
  activeLocale: string;
}) {
  return (
    <section className="grid gap-4">
      <div>
        <p className="adm-section-tag">{group.title}</p>
        {group.description ? (
          <p className="mt-1 max-w-2xl text-xs leading-5" style={{ color: "var(--adm-muted)" }}>{group.description}</p>
        ) : null}
      </div>
      <div className="grid gap-4">
        {group.fields.map((field) => (
          <div key={field.key} className="grid gap-2 md:grid-cols-2">
            {locales.map((locale) => {
              const hidden = activeLocale !== locale.code;
              const name = `${locale.code}:${field.key}`;
              const defaultValue = copy[locale.code]?.[field.key] ?? "";
              const placeholder = defaults[locale.code]?.[field.key] ?? englishDefaults[field.key] ?? "";
              const label = `${field.label} (${locale.code.toUpperCase()})`;
              if (field.area) {
                return (
                  <div key={locale.code} hidden={hidden} className="md:col-span-2">
                    <AdminRichTextField
                      label={label}
                      help={field.hint}
                      name={name}
                      defaultValue={defaultValue}
                      placeholder={placeholder}
                    />
                  </div>
                );
              }
              return (
                <div key={locale.code} hidden={hidden}>
                  <AdminTextField
                    label={label}
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
  );
}
