"use client";

import { useState, useTransition } from "react";

import {
  saveStorefrontCopyAction,
  type StorefrontCopyActionState,
} from "@/app/admin/actions/storefront-copy";
import { FooterEmailsEditor } from "@/components/admin/settings/footer-emails-editor";
import { FooterLinkColumnEditor } from "@/components/admin/settings/footer-link-column-editor";
import { HeaderNavEditor } from "@/components/admin/settings/header-nav-editor";
import { useAdminToast } from "@/components/admin/shared/admin-toast";
import { AdminLocaleTabs, useAdminActiveLocale, type AdminLocaleStatus, type AdminLocaleTab } from "@/components/admin/shared/admin-locale-workspace";
import { AuthMessage } from "@/components/auth/auth-form-primitives";
import { AdminLongTextField, AdminTextField } from "@/components/synarava-cms";
import {
  DEFAULT_FOOTER_LEGAL_LABEL_KEYS,
  DEFAULT_FOOTER_SERVICE_LABEL_KEYS,
  type FooterLinksData,
} from "@/lib/content/footer-links-fields";
import type { HeaderNavData } from "@/lib/content/header-nav-fields";
import { STOREFRONT_COPY_GROUPS } from "@/lib/content/storefront-copy-fields";
import type { StorefrontCopy } from "@/lib/content/storefront-copy";

const SECTION_JUMPS = [
  { href: "#copy-header-main", label: "Header" },
  { href: "#copy-footer-service", label: "Service" },
  { href: "#copy-footer-legal", label: "Legal" },
  { href: "#copy-footer-socials", label: "Social" },
  { href: "#copy-footer-emails", label: "Emails" },
  { href: "#copy-service-contact", label: "Contact CTA" },
] as const;

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
          Header and footer links: name + path (add/remove/reorder). Missing destinations show as errors
          in admin and are hidden on the storefront. Contact emails are shared across languages.
        </p>
        <nav className="flex flex-wrap gap-2 text-xs" aria-label="Jump to section">
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

      <HeaderNavEditor
        initial={headerNav}
        activeLocale={activeLocale}
        labelPlaceholders={activePlaceholders}
        locales={locales}
      />

      <FooterLinkColumnEditor
        columnId="service"
        title="Footer — service links"
        description="Service column links. Name is per locale; path is shared. Contact emails are edited below."
        listLabel="Service links"
        initial={footerLinks.service}
        activeLocale={activeLocale}
        labelPlaceholders={activePlaceholders}
        defaultLabelKeys={DEFAULT_FOOTER_SERVICE_LABEL_KEYS}
        locales={locales}
        fieldName="footerServiceLinks"
        hrefPlaceholder="/care"
      />

      <FooterEmailsEditor initialEmails={contactEmails} />

      <FooterLinkColumnEditor
        columnId="legal"
        title="Footer — legal links"
        description="Bottom legal row. Supports storefront paths and external https:// URLs (e.g. Livro de Reclamações)."
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

      <FooterLinkColumnEditor
        columnId="socials"
        title="Footer — social links"
        description="Optional social column. Add Instagram, Pinterest, etc. with a label and URL. Hidden on the storefront when empty."
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
          {isPending ? "Saving..." : "Save Shared"}
        </button>
      </div>
    </form>
  );
}
