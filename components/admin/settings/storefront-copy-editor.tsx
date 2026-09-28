"use client";

import { useEffect, useState, useTransition } from "react";

import {
  saveStorefrontCopyAction,
  type StorefrontCopyActionState,
} from "@/app/admin/actions/storefront-copy";
import { FooterEmailsEditor } from "@/components/admin/settings/footer-emails-editor";
import { FooterLinkColumnEditor } from "@/components/admin/settings/footer-link-column-editor";
import { HeaderNavEditor } from "@/components/admin/settings/header-nav-editor";
import { useAdminToast } from "@/components/admin/shared/admin-toast";
import { AdminLocaleTabs, useAdminActiveLocale, type AdminLocaleStatus, type AdminLocaleTab } from "@/components/admin/shared/admin-locale-workspace";
import { AdminAlert, AdminLongTextField, AdminPanel, AdminSectionTabs, AdminTextField } from "@/components/synarava-cms";
import {
  DEFAULT_FOOTER_LEGAL_LABEL_KEYS,
  DEFAULT_FOOTER_SERVICE_LABEL_KEYS,
  type FooterLinksData,
} from "@/lib/content/footer-links-fields";
import type { HeaderNavData } from "@/lib/content/header-nav-fields";
import { STOREFRONT_COPY_GROUPS } from "@/lib/content/storefront-copy-fields";
import type { StorefrontCopy } from "@/lib/content/storefront-copy";

const SHARED_AREAS = [
  { id: "header", label: "Header", detail: "Main links and menu labels" },
  { id: "footer", label: "Footer", detail: "Columns, legal line, emails" },
  { id: "cookies", label: "Cookies", detail: "Banner and settings page" },
  { id: "contact", label: "Contact", detail: "Banner on service pages" },
] as const;

type SharedAreaId = (typeof SHARED_AREAS)[number]["id"];

const GROUP_AREA: Record<string, SharedAreaId> = {
  "header-chrome": "header",
  "footer-brand": "footer",
  "footer-nav": "footer",
  "footer-service-heading": "footer",
  "footer-social-heading": "footer",
  "cookies-consent": "cookies",
  "cookies-page": "cookies",
  "service-contact": "contact",
};

function areaForHash(hash: string): SharedAreaId | null {
  const id = hash.replace(/^#/, "");
  if (!id) return null;
  if (id === "shared-header" || id.startsWith("copy-header")) return "header";
  if (id === "shared-footer" || id.startsWith("copy-footer")) return "footer";
  if (id === "shared-cookies" || id.startsWith("copy-cookies")) return "cookies";
  if (id === "shared-contact" || id === "copy-service-contact") return "contact";
  return null;
}

export function StorefrontCopyEditor({
  copy,
  defaults,
  headerNav,
  footerLinks,
  contactEmails,
  locales,
  ptStatus,
}: {
  copy: StorefrontCopy;
  defaults: StorefrontCopy;
  headerNav: HeaderNavData;
  footerLinks: FooterLinksData;
  contactEmails: string[];
  locales: AdminLocaleTab[];
  ptStatus?: AdminLocaleStatus;
}) {
  const [state, setState] = useState<StorefrontCopyActionState>({});
  const [isPending, startTransition] = useTransition();
  const { pushToast } = useAdminToast();
  const [activeLocale, selectLocale] = useAdminActiveLocale("storefront-copy", locales, locales[0]?.code ?? "en");
  const [area, setArea] = useState<SharedAreaId>("header");

  useEffect(() => {
    function syncFromHash() {
      const next = areaForHash(window.location.hash);
      if (next) setArea(next);
    }
    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, []);

  function selectArea(next: string) {
    if (next !== "header" && next !== "footer" && next !== "cookies" && next !== "contact") return;
    setArea(next);
    const hash = `#shared-${next}`;
    if (window.location.hash !== hash) {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${hash}`);
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    }
  }
  const englishDefaults = defaults.en ?? {};
  const activePlaceholders = {
    ...englishDefaults,
    ...(defaults[activeLocale] ?? {}),
  };

  function formAction(formData: FormData) {
    startTransition(async () => {
      const result = await saveStorefrontCopyAction(formData);
      setState(result);
      if (result.error) pushToast({ message: result.error, tone: "error" });
      if (result.success) pushToast({ message: result.success, tone: "success" });
    });
  }

  function copyGroups(areaId: SharedAreaId) {
    return STOREFRONT_COPY_GROUPS.filter((group) => GROUP_AREA[group.id] === areaId);
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
            ptStatus={ptStatus}
          />
        </AdminPanel.Header>
        <AdminPanel.Body>
        <AdminSectionTabs
          embedded
          aria-label="Shared areas"
          active={area}
          onChange={selectArea}
          items={SHARED_AREAS.map((item) => ({ id: item.id, label: item.label, detail: item.detail }))}
        >
          <div className="adm-inset-x grid gap-8 py-5">
            <div id="shared-header" hidden={area !== "header"} className="grid gap-10">
              <HeaderNavEditor
                embedded
                initial={headerNav}
                activeLocale={activeLocale}
                labelPlaceholders={activePlaceholders}
                locales={locales}
              />
              {copyGroups("header").map((group) => (
                <CopyGroup
                  key={group.id}
                  group={group}
                  copy={copy}
                  defaults={defaults}
                  englishDefaults={englishDefaults}
                  locales={locales}
                  activeLocale={activeLocale}
                />
              ))}
            </div>

            <div id="shared-footer" hidden={area !== "footer"} className="grid gap-10">
              {copyGroups("footer").filter((group) => group.id === "footer-brand" || group.id === "footer-nav" || group.id === "footer-service-heading").map((group) => (
                <CopyGroup
                  key={group.id}
                  group={group}
                  copy={copy}
                  defaults={defaults}
                  englishDefaults={englishDefaults}
                  locales={locales}
                  activeLocale={activeLocale}
                />
              ))}
              <FooterLinkColumnEditor
                embedded
                columnId="service"
                title="Service column"
                description="Service column. Name is per locale; path is shared."
                listLabel="Service links"
                initial={footerLinks.service}
                activeLocale={activeLocale}
                labelPlaceholders={activePlaceholders}
                defaultLabelKeys={DEFAULT_FOOTER_SERVICE_LABEL_KEYS}
                locales={locales}
                fieldName="footerServiceLinks"
                hrefPlaceholder="/care"
              />
              <FooterEmailsEditor embedded initialEmails={contactEmails} />
              <FooterLinkColumnEditor
                embedded
                columnId="legal"
                title="Legal line"
                description="The quiet line under the columns. Name is per locale; path is shared. External https:// URLs are allowed."
                listLabel="Legal links"
                initial={footerLinks.legal}
                activeLocale={activeLocale}
                labelPlaceholders={activePlaceholders}
                defaultLabelKeys={DEFAULT_FOOTER_LEGAL_LABEL_KEYS}
                locales={locales}
                fieldName="footerLegalLinks"
                hrefPlaceholder="/privacy"
                allowExternalHint
              />
              {copyGroups("footer").filter((group) => group.id === "footer-social-heading").map((group) => (
                <CopyGroup
                  key={group.id}
                  group={group}
                  copy={copy}
                  defaults={defaults}
                  englishDefaults={englishDefaults}
                  locales={locales}
                  activeLocale={activeLocale}
                />
              ))}
              <FooterLinkColumnEditor
                embedded
                columnId="socials"
                title="Social column"
                description="Optional column. Hidden on the storefront when empty."
                listLabel="Social links"
                initial={footerLinks.socials}
                activeLocale={activeLocale}
                labelPlaceholders={activePlaceholders}
                defaultLabelKeys={{}}
                locales={locales}
                fieldName="footerSocialLinks"
                hrefPlaceholder="https://"
                allowExternalHint
              />
            </div>

            <div id="shared-cookies" hidden={area !== "cookies"} className="grid gap-10">
              {copyGroups("cookies").map((group) => (
                <CopyGroup
                  key={group.id}
                  group={group}
                  copy={copy}
                  defaults={defaults}
                  englishDefaults={englishDefaults}
                  locales={locales}
                  activeLocale={activeLocale}
                />
              ))}
            </div>

            <div id="shared-contact" hidden={area !== "contact"} className="grid gap-10">
              {copyGroups("contact").map((group) => (
                <CopyGroup
                  key={group.id}
                  group={group}
                  copy={copy}
                  defaults={defaults}
                  englishDefaults={englishDefaults}
                  locales={locales}
                  activeLocale={activeLocale}
                />
              ))}
            </div>
          </div>
        </AdminSectionTabs>

        <div className="adm-inset-x flex flex-wrap items-center justify-between gap-3 border-t py-4" style={{ borderColor: "var(--adm-border)" }}>
          <p className="text-xs leading-5" style={{ color: "var(--adm-muted)" }}>
            Save writes header, footer, cookies, and contact together.
          </p>
          <button type="submit" className="adm-btn-primary" disabled={isPending}>
            {isPending ? "Saving..." : "Save Shared"}
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
  group: (typeof STOREFRONT_COPY_GROUPS)[number];
  copy: StorefrontCopy;
  defaults: StorefrontCopy;
  englishDefaults: Record<string, string>;
  locales: AdminLocaleTab[];
  activeLocale: string;
}) {
  return (
    <section id={`copy-${group.id}`} className="grid gap-4 scroll-mt-24">
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
              const localeLabel = `${field.label} (${locale.code.toUpperCase()})`;
              const hidden = activeLocale !== locale.code;
              const name = `${locale.code}:${field.key}`;
              const defaultValue = copy[locale.code]?.[field.key] ?? "";
              const placeholder = defaults[locale.code]?.[field.key] ?? englishDefaults[field.key] ?? "";

              if (field.area) {
                return (
                  <div key={locale.code} hidden={hidden} className={field.area ? "md:col-span-2" : undefined}>
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
  );
}
