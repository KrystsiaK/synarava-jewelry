import en from "@/messages/en.json";
import pt from "@/messages/pt.json";
import { flattenMessages } from "@/lib/i18n/utils";
import { getStorefrontCopy } from "@/lib/content/storefront-copy";
import { StorefrontCopyEditor } from "@/components/admin/settings/storefront-copy-editor";

export default async function AdminSettingsPage() {
  const copy = await getStorefrontCopy();
  const defaults = {
    en: flattenMessages(en as Record<string, unknown>),
    pt: flattenMessages(pt as Record<string, unknown>),
  };

  return (
    <div className="space-y-8">
      <div>
        <p className="adm-section-tag mb-3">[ SYN-ADM // COPY ]</p>
        <h1 className="adm-page-title">Storefront copy</h1>
        <p className="adm-page-subtitle">
          Main menu, footer, and the FAQ / Care / Shipping / Returns pages — text only, no layout changes.
        </p>
      </div>
      <StorefrontCopyEditor copy={copy} defaults={defaults} />
    </div>
  );
}
