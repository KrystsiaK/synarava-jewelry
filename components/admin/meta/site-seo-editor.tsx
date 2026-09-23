"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { saveSiteSeoAction, type SiteSeoActionState } from "@/app/admin/actions/site-seo";
import { useAdminToast } from "@/components/admin/shared/admin-toast";
import { AuthMessage } from "@/components/auth/auth-form-primitives";
import { AdminLongTextField, AdminTextField } from "@/components/synarava-cms";
import {
  SITE_SEO_DEFAULTS,
  SITE_SEO_FIELD_DEFS,
  type SiteSeoFields,
} from "@/lib/content/site-seo-fields";

const HUB_LINKS = [
  {
    href: "/admin/pages",
    title: "Pages",
    body: "Per-page titles, descriptions, and editorial SEO live on each page editor.",
  },
  {
    href: "/admin/products",
    title: "Catalog",
    body: "Product SEO title and description sync with Shopify from the product editor.",
  },
  {
    href: "/admin/translations",
    title: "Localization",
    body: "Review Shopify translation conflicts for catalog and site chrome.",
  },
] as const;

export function SiteSeoEditor({
  overrides,
}: {
  overrides: Partial<SiteSeoFields>;
}) {
  const [state, setState] = useState<SiteSeoActionState>({});
  const [isPending, startTransition] = useTransition();
  const { pushToast } = useAdminToast();

  function formAction(formData: FormData) {
    startTransition(async () => {
      const result = await saveSiteSeoAction(formData);
      setState(result);
      if (result.error) pushToast({ message: result.error, tone: "error" });
      if (result.success) pushToast({ message: result.success, tone: "success" });
    });
  }

  return (
    <div className="grid gap-8">
      <section className="adm-panel grid gap-4 p-5 md:p-6">
        <div>
          <p className="adm-section-tag">Where else SEO lives</p>
          <p className="mt-1 text-xs" style={{ color: "var(--adm-muted)" }}>
            These defaults apply site-wide. Page and product SEO stay on their own editors — not here, and not as a free-form Shopify metafield browser.
          </p>
        </div>
        <ul className="grid gap-3 md:grid-cols-3">
          {HUB_LINKS.map((item) => (
            <li key={item.href}>
              <Link href={item.href} className="block rounded border p-3 transition-colors hover:border-[var(--adm-fg)]" style={{ borderColor: "var(--adm-border)" }}>
                <p className="adm-label">{item.title}</p>
                <p className="mt-1 text-xs leading-5" style={{ color: "var(--adm-muted)" }}>{item.body}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <form action={formAction} className="grid gap-8">
        <AuthMessage error={state.error} />
        <section className="adm-panel grid gap-4 p-5 md:p-6">
          <div>
            <p className="adm-section-tag">Site-wide defaults</p>
            <p className="mt-1 text-xs" style={{ color: "var(--adm-muted)" }}>
              Leave a field empty to fall back to the shipped default (placeholder). English source for the whole storefront.
            </p>
          </div>
          <div className="grid gap-4">
            {SITE_SEO_FIELD_DEFS.map((field) => {
              if (field.area) {
                return (
                  <AdminLongTextField
                    key={field.key}
                    label={field.label}
                    help={field.hint}
                    name={field.key}
                    defaultValue={overrides[field.key] ?? ""}
                    placeholder={SITE_SEO_DEFAULTS[field.key]}
                    rows={3}
                  />
                );
              }
              return (
                <AdminTextField
                  key={field.key}
                  label={field.label}
                  help={field.hint}
                  name={field.key}
                  defaultValue={overrides[field.key] ?? ""}
                  placeholder={SITE_SEO_DEFAULTS[field.key]}
                />
              );
            })}
          </div>
        </section>

        <div className="flex justify-end" style={{ borderTop: "1px solid var(--adm-border)", paddingTop: "1rem" }}>
          <button type="submit" className="adm-btn-primary" disabled={isPending}>
            {isPending ? "Saving..." : "Save site SEO"}
          </button>
        </div>
      </form>
    </div>
  );
}
