import en from "@/messages/en.json";
import pt from "@/messages/pt.json";
import ru from "@/messages/ru.json";

import { CommerceCopyEditor } from "@/components/admin/commerce/commerce-copy-editor";
import { getCommerceCopy } from "@/lib/content/commerce-copy";
import { overlayLegacyHeaderLabels, type LocaleCopy } from "@/lib/content/commerce-copy-fields";
import { getStorefrontCopy } from "@/lib/content/storefront-copy";
import { flattenMessages } from "@/lib/i18n/utils";
import { getStorefrontLocales } from "@/lib/i18n/storefront-locale-cache";

export default async function AdminCommercePage() {
  const [commerce, shared, registryLocales] = await Promise.all([
    getCommerceCopy(),
    getStorefrontCopy(),
    getStorefrontLocales(),
  ]);
  const defaults: LocaleCopy = {
    en: flattenMessages(en as Record<string, unknown>),
    pt: flattenMessages(pt as Record<string, unknown>),
    ru: flattenMessages(ru as Record<string, unknown>),
  };
  const locales = registryLocales.map((locale) => ({ code: locale.code, label: locale.nativeName }));

  return (
    <div className="space-y-8">
      <div>
        <p className="adm-section-tag mb-3">[ SYN-ADM // CART ]</p>
        <h1 className="adm-page-title">Cart & account</h1>
        <p className="adm-page-subtitle">
          Cart page, the add-to-cart confirmation, and the login page. Empty fields fall back to the
          shipped copy in messages. Shopify hosts checkout, payment, and the email sign-in code, so
          those screens are not edited here and this copy is not synced.
        </p>
      </div>
      <CommerceCopyEditor
        copy={overlayLegacyHeaderLabels(commerce, shared)}
        defaults={defaults}
        locales={locales}
      />
    </div>
  );
}
