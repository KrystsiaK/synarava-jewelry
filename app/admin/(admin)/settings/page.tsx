import en from "@/messages/en.json";
import pt from "@/messages/pt.json";
import ru from "@/messages/ru.json";
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
  // Shipped dictionaries for EN / PT / RU. Any other registered locale falls
  // back to English placeholders via defaults[locale] ?? defaults.en.
  const defaults: StorefrontCopy = {
    en: flattenMessages(en as Record<string, unknown>),
    pt: flattenMessages(pt as Record<string, unknown>),
    ru: flattenMessages(ru as Record<string, unknown>),
  };
  const locales = registryLocales.map((locale) => ({ code: locale.code, label: locale.nativeName }));

  return (
    <div className="space-y-8">
      <div>
        <p className="adm-section-tag mb-3">[ SYN-ADM // SHARED ]</p>
        <h1 className="adm-page-title">Shared</h1>
        <p className="adm-page-subtitle">
          Header, footer, home chrome, cookies, the service-page contact banner, and the leave-a-review form. One save covers every tab.
          Empty labels fall back to shipped defaults. Per-page copy stays under Pages.
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
