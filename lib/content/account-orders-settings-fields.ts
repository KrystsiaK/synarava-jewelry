// Account orders buyer-action toggles. Client-safe. Stored in SiteSetting
// `account-orders-settings-v1`. Not localized — booleans, not copy.
// Copy for labels/hints lives in account-page-fields (commerce-copy-v1).

export const ACCOUNT_ORDERS_SETTINGS_KEY = "account-orders-settings-v1";

export type AccountOrdersSettings = {
  /**
   * When true, Orders tab may offer Buy again via the headless cart-permalink
   * bridge. Default false — keep frozen until BA matrix + redirect theme pass
   * (see docs/post-purchase-ops-runbook.md).
   */
  buyAgainOnOrdersEnabled: boolean;
  /**
   * When true, mount the headless ReturnRequestPanel beside the Shopify
   * account deep-link. Default false — Shopify account remains canonical
   * until native return UX is validated in production.
   */
  headlessReturnEnabled: boolean;
};

export const ACCOUNT_ORDERS_SETTINGS_DEFAULTS: AccountOrdersSettings = {
  buyAgainOnOrdersEnabled: false,
  headlessReturnEnabled: false,
};

export const ACCOUNT_ORDERS_SETTINGS_FIELD_DEFS: Array<{
  key: keyof AccountOrdersSettings;
  label: string;
  hint: string;
}> = [
  {
    key: "buyAgainOnOrdersEnabled",
    label: "Buy again on Orders tab",
    hint: "Off by default (ops freeze). When on, eligible orders link into the headless cart permalink bridge. Still requires Shopify Checkout Buy again + redirect theme for production BA.",
  },
  {
    key: "headlessReturnEnabled",
    label: "Headless return form on Orders",
    hint: "Off by default. When on, shows the in-app return request form for returnable lines. Shopify secure account remains available either way.",
  },
];
