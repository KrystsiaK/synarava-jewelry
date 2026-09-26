import en from "@/messages/en.json";
import pt from "@/messages/pt.json";
import { flattenMessages } from "@/lib/i18n/utils";
import { getFooterContactEmails } from "@/lib/content/footer-contact";
import { getFooterLinks } from "@/lib/content/footer-links";
import { getHeaderNav } from "@/lib/content/header-nav";
import { getStorefrontCopy, type StorefrontCopy } from "@/lib/content/storefront-copy";
import { StorefrontCopyEditor } from "@/components/admin/settings/storefront-copy-editor";
import { STOREFRONT_COPY_KEY } from "@/lib/content/storefront-copy";
import { AdminSyncInlineWarning } from "@/components/admin/translations/admin-sync-inline-warning";
import { db } from "@/lib/db";
import { getLatestReconcileDifferences } from "@/lib/shopify/reconciliation-run";
import type { AdminLocaleStatus } from "@/components/admin/shared/admin-locale-workspace";
import { getStorefrontLocales } from "@/lib/i18n/storefront-locale-cache";

export default async function AdminSettingsPage() {
  const [copy, headerNav, footerLinks, contactEmails, binding, syncDifferences, registryLocales] =
    await Promise.all([
      getStorefrontCopy(),
      getHeaderNav(),
      getFooterLinks(),
      getFooterContactEmails(),
      db.shopifyTranslationBinding.findUnique({
        where: { resourceType_entityId: { resourceType: "METAOBJECT", entityId: STOREFRONT_COPY_KEY } },
        include: { syncEvents: { orderBy: { createdAt: "desc" }, take: 1 } },
      }),
      getLatestReconcileDifferences(),
      getStorefrontLocales(),
    ]);
  const storefrontSyncDifferences = syncDifferences.filter(
    (difference) => difference.rootEntityType === "STOREFRONT_COPY" && difference.rootEntityId === STOREFRONT_COPY_KEY,
  );
  const eventStatus = binding?.syncEvents[0]?.status;
  const ptStatus: AdminLocaleStatus = eventStatus === "SUCCEEDED"
    ? "SYNCED"
    : eventStatus === "FAILED" || eventStatus === "CONFLICT"
      ? eventStatus
      : "PENDING";
  // Only English and Portuguese ship a shipped-copy JSON file today — any
  // other registered locale simply has no entry here, and the editor's own
  // fallback chain (defaults[locale] ?? defaults.en) shows the English
  // shipped copy as its placeholder until that locale gets real defaults.
  const defaults: StorefrontCopy = {
    en: flattenMessages(en as Record<string, unknown>),
    pt: flattenMessages(pt as Record<string, unknown>),
  };
  const locales = registryLocales.map((locale) => ({ code: locale.code, label: locale.nativeName }));

  return (
    <div className="space-y-8">
      <div>
        <p className="adm-section-tag mb-3">[ SYN-ADM // SHARED ]</p>
        <h1 className="adm-page-title">Shared</h1>
        <p className="adm-page-subtitle">
          Site-wide pieces: header and footer links (name + path, add/remove/reorder), contact emails,
          chrome labels, the service-page contact CTA, and cookie banner / settings copy. Links to deleted
          pages stay in admin with an error and are hidden on the storefront. Empty labels fall back to
          shipped defaults. Per-page copy is edited under Pages.
        </p>
        <AdminSyncInlineWarning className="mt-4" differences={storefrontSyncDifferences} />
      </div>
      <StorefrontCopyEditor
        copy={copy}
        defaults={defaults}
        headerNav={headerNav}
        footerLinks={footerLinks}
        contactEmails={contactEmails}
        locales={locales}
        ptStatus={ptStatus}
      />
    </div>
  );
}
