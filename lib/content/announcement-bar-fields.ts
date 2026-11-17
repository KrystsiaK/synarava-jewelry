/** Client-safe announcement-bar setting keys and types (no DB). */

export const ANNOUNCEMENT_BAR_SETTING_KEY = "announcement-bar-v1";

/** Stable SyncResult resource id for the shop free-shipping threshold window. */
export const FREE_SHIPPING_THRESHOLD_RESOURCE_ID = "shop-free-shipping";

/** Storefront / admin copy key — template must include `{amount}`. */
export const ANNOUNCEMENT_BAR_COPY_KEY = "announcement.bar";

export type FreeShippingMoney = {
  amount: string;
  currencyCode: string;
};

/** Shopify-shaped commerce window for the free-shipping threshold (ADR-0010). */
export type FreeShippingThresholdWindow = {
  freeShippingMinSubtotal: FreeShippingMoney | null;
};

export type AnnouncementBarSetting = {
  enabled: boolean;
  /** Synarava working threshold — adopted only via human Take Shopify. */
  threshold: FreeShippingMoney | null;
  /** Last Shopify observation (refresh-only; never auto-writes threshold). */
  shopifySnapshot: FreeShippingThresholdWindow | null;
};

export const DEFAULT_ANNOUNCEMENT_BAR_SETTING: AnnouncementBarSetting = {
  enabled: false,
  threshold: null,
  shopifySnapshot: null,
};
