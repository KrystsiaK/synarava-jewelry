/** Client-safe announcement-bar setting keys and types (no DB). */

export const ANNOUNCEMENT_BAR_SETTING_KEY = "announcement-bar-v1";

/** Storefront / admin copy key — template must include `{amount}`. */
export const ANNOUNCEMENT_BAR_COPY_KEY = "announcement.bar";

export type FreeShippingMoney = {
  amount: string;
  currencyCode: string;
};

/** Shopify-shaped observation window for the free-shipping threshold. */
export type FreeShippingThresholdWindow = {
  freeShippingMinSubtotal: FreeShippingMoney | null;
};

/**
 * Synarava owns on/off + banner copy only.
 * Threshold amount is Shopify-sole: read from `shopifySnapshot`, never copied locally.
 */
export type AnnouncementBarSetting = {
  enabled: boolean;
  /** Last Shopify observation (refresh-only). */
  shopifySnapshot: FreeShippingThresholdWindow | null;
  /** ISO timestamp of the last successful Shopify threshold refresh. */
  shopifyCheckedAt: string | null;
};

export const DEFAULT_ANNOUNCEMENT_BAR_SETTING: AnnouncementBarSetting = {
  enabled: false,
  shopifySnapshot: null,
  shopifyCheckedAt: null,
};
