"use client";

import { HardDriveUpload, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

import { saveSiteSeoAction, type SiteSeoActionState } from "@/app/admin/actions/site-seo";
import { useAdminToast } from "@/components/admin/shared/admin-toast";
import {
  AdminAlert,
  AdminIconButton,
  AdminPanel,
  AdminRichTextField,
  AdminTextField,
} from "@/components/synarava-cms";
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
    href: "/admin/collections",
    title: "Collections",
    body: "Collection SEO title and description sync with Shopify from the collection editor.",
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
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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

      <form action={formAction} id="site-seo-defaults">
        <AdminAlert message={state.error} />
        <AdminPanel.Root>
          <AdminPanel.Header sticky className="adm-panel__header--ruled">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="adm-section-tag">Site-wide defaults</p>
                <p className="mt-1 text-xs" style={{ color: "var(--adm-muted)" }}>
                  Leave a field empty to fall back to the shipped default. English source for the whole storefront.
                </p>
              </div>
              <AdminIconButton
                type="submit"
                label={isPending ? "Saving site SEO" : "Save site SEO"}
                tooltip={
                  isPending
                    ? "Saving site SEO…"
                    : "Save site-wide SEO defaults. Empty fields keep the shipped fallback."
                }
                disabled={isPending}
              >
                {isPending ? (
                  <RefreshCw className="size-3.5 animate-spin" strokeWidth={2} aria-hidden="true" />
                ) : (
                  <HardDriveUpload className="size-3.5" strokeWidth={2} aria-hidden="true" />
                )}
              </AdminIconButton>
            </div>
          </AdminPanel.Header>
          <AdminPanel.Body>
            <div className="adm-inset-x grid gap-4 py-5">
              {SITE_SEO_FIELD_DEFS.map((field) => {
                if (field.area) {
                  return (
                    <AdminRichTextField
                      key={field.key}
                      label={field.label}
                      help={field.hint}
                      name={field.key}
                      defaultValue={overrides[field.key] ?? ""}
                      placeholder={SITE_SEO_DEFAULTS[field.key]}
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
          </AdminPanel.Body>
        </AdminPanel.Root>
      </form>
    </div>
  );
}
