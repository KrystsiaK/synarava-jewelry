import en from "@/messages/en.json";
import pt from "@/messages/pt.json";
import { flattenMessages } from "@/lib/i18n/utils";
import { getStorefrontCopy } from "@/lib/content/storefront-copy";
import { StorefrontCopyEditor } from "@/components/admin/settings/storefront-copy-editor";
import { STOREFRONT_COPY_KEY } from "@/lib/content/storefront-copy";
import { db } from "@/lib/db";
import type { AdminLocaleStatus } from "@/components/admin/shared/admin-locale-workspace";

export default async function AdminSettingsPage() {
  const [copy, binding] = await Promise.all([
    getStorefrontCopy(),
    db.shopifyTranslationBinding.findUnique({
      where: { resourceType_entityId: { resourceType: "METAOBJECT", entityId: STOREFRONT_COPY_KEY } },
      include: { syncEvents: { orderBy: { createdAt: "desc" }, take: 1 } },
    }),
  ]);
  const eventStatus = binding?.syncEvents[0]?.status;
  const ptStatus: AdminLocaleStatus = eventStatus === "SUCCEEDED"
    ? "SYNCED"
    : eventStatus === "FAILED" || eventStatus === "CONFLICT"
      ? eventStatus
      : "PENDING";
  const defaults = {
    en: flattenMessages(en as Record<string, unknown>),
    pt: flattenMessages(pt as Record<string, unknown>),
  };

  return (
    <div className="space-y-8">
      <div>
        <p className="adm-section-tag mb-3">[ SYN-ADM // COPY ]</p>
        <h1 className="adm-page-title">Site copy</h1>
        <p className="adm-page-subtitle">
          Main menu and footer — text only, no layout changes. Page-specific copy (Shop, Care, FAQ, Shipping, Returns) is edited on that page in Pages.
        </p>
      </div>
      <StorefrontCopyEditor copy={copy} defaults={defaults} ptStatus={ptStatus} />
    </div>
  );
}
