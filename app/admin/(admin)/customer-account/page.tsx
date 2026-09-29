import en from "@/messages/en.json";
import pt from "@/messages/pt.json";
import ru from "@/messages/ru.json";

import { AccountOrdersSettingsEditor } from "@/components/admin/account/account-orders-settings-editor";
import { AccountPageEditor } from "@/components/admin/account/account-page-editor";
import { getAccountOrdersSettings } from "@/lib/content/account-orders-settings";
import { ACCOUNT_PAGE_KEYS } from "@/lib/content/account-page-fields";
import { getCommerceCopy } from "@/lib/content/commerce-copy";
import type { LocaleCopy } from "@/lib/content/commerce-copy-fields";
import { flattenMessages } from "@/lib/i18n/utils";
import { getStorefrontLocales } from "@/lib/i18n/storefront-locale-cache";

function pickAccountPage(copy: LocaleCopy): LocaleCopy {
  const keys = new Set(ACCOUNT_PAGE_KEYS);
  const next: LocaleCopy = {};
  for (const [locale, fields] of Object.entries(copy)) {
    const picked = Object.fromEntries(Object.entries(fields).filter(([key]) => keys.has(key)));
    if (Object.keys(picked).length > 0) next[locale] = picked;
  }
  return next;
}

export default async function AdminCustomerAccountPage() {
  const [commerce, registryLocales, ordersSettings] = await Promise.all([
    getCommerceCopy(),
    getStorefrontLocales(),
    getAccountOrdersSettings(),
  ]);
  const defaults: LocaleCopy = {
    en: flattenMessages(en as Record<string, unknown>),
    pt: flattenMessages(pt as Record<string, unknown>),
    ru: flattenMessages(ru as Record<string, unknown>),
  };

  return (
    <div className="space-y-8">
      <div>
        <p className="adm-section-tag mb-3">[ SYN-ADM // ACCOUNT ]</p>
        <h1 className="adm-page-title">Customer account</h1>
        <p className="adm-page-subtitle">
          Copy on the signed-in account page: the frame, every tab, and the return request.
          Order status chips and buyer-action labels are editable here (обменка).
          Buyer-action toggles (Buy again / headless return) sit above the copy editor.
          The customer’s name, email, orders, addresses, and reviews come from Shopify and are not edited here.
          The form for leaving a review is under Shared.
          This copy is not synced to Shopify.
        </p>
      </div>
      <AccountOrdersSettingsEditor settings={ordersSettings} />
      <AccountPageEditor
        copy={pickAccountPage(commerce)}
        defaults={defaults}
        locales={registryLocales.map((locale) => ({ code: locale.code, label: locale.nativeName }))}
      />
    </div>
  );
}
