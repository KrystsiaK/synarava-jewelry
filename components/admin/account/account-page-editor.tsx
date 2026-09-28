"use client";

import { useEffect, useState, useTransition } from "react";

import {
  saveAccountPageAction,
  type AccountPageActionState,
} from "@/app/admin/actions/account-page";
import { useAdminToast } from "@/components/admin/shared/admin-toast";
import {
  AdminLocaleTabs,
  useAdminActiveLocale,
  type AdminLocaleStatus,
  type AdminLocaleTab,
} from "@/components/admin/shared/admin-locale-workspace";
import { AdminAlert, AdminRichTextField, AdminPanel, AdminSectionTabs, AdminTextField } from "@/components/synarava-cms";
import {
  ACCOUNT_PAGE_AREAS,
  ACCOUNT_PAGE_GROUPS,
  accountPageAreaForHash,
  type AccountPageAreaId,
} from "@/lib/content/account-page-fields";
import type { LocaleCopy } from "@/lib/content/commerce-copy-fields";
import type { StorefrontCopyGroup } from "@/lib/content/storefront-copy-fields";

export function AccountPageEditor({
  copy,
  defaults,
  locales,
}: {
  copy: LocaleCopy;
  defaults: LocaleCopy;
  locales: AdminLocaleTab[];
}) {
  const [state, setState] = useState<AccountPageActionState>({});
  const [isPending, startTransition] = useTransition();
  const { pushToast } = useAdminToast();
  const [activeLocale, selectLocale] = useAdminActiveLocale("account-page", locales, locales[0]?.code ?? "en");
  const [area, setArea] = useState<AccountPageAreaId>("frame");
  const status: AdminLocaleStatus = "NOT_APPLICABLE";
  const englishDefaults = defaults.en ?? {};

  useEffect(() => {
    function syncFromHash() {
      const next = accountPageAreaForHash(window.location.hash);
      if (next) setArea(next);
    }
    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, []);

  function selectArea(next: string) {
    const areaId = accountPageAreaForHash(next);
    if (!areaId) return;
    setArea(areaId);
    const hash = `#account-${areaId}`;
    if (window.location.hash !== hash) {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${hash}`);
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    }
  }

  function formAction(formData: FormData) {
    startTransition(async () => {
      const result = await saveAccountPageAction(formData);
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
          />
        </AdminPanel.Header>
        <AdminPanel.Body>
          <AdminSectionTabs
            embedded
            aria-label="Account page"
            active={area}
            onChange={selectArea}
            items={ACCOUNT_PAGE_AREAS.map((item) => ({ id: item.id, label: item.label, detail: item.detail }))}
          >
            <div className="adm-inset-x grid gap-8 py-5">
              {ACCOUNT_PAGE_GROUPS.map((group) => (
                <div key={group.id} id={`account-${group.id}`} hidden={area !== group.id}>
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
          <div className="adm-inset-x flex flex-wrap items-center justify-between gap-3 border-t py-4" style={{ borderColor: "var(--adm-border)" }}>
            <p className="text-xs leading-5" style={{ color: "var(--adm-muted)" }}>
              Empty fields keep the shipped copy. Orders, addresses, reviews, and the email come from Shopify.
            </p>
            <button type="submit" className="adm-btn-primary" disabled={isPending}>
              {isPending ? "Saving..." : "Save customer account"}
            </button>
          </div>
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
