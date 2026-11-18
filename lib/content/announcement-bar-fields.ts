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

/** Which delivery-profile rate produced the last Shopify observation (not compared). */
export type FreeShippingObservationSource = {
  profileName: string;
  zoneName: string;
  rateName: string;
};

export type AnnouncementBarSetting = {
  enabled: boolean;
  /** Synarava working threshold — adopted only via human Take Shopify. */
  threshold: FreeShippingMoney | null;
  /** Last Shopify observation (refresh-only; never auto-writes threshold). */
  shopifySnapshot: FreeShippingThresholdWindow | null;
  /**
   * Last Shopify read outcome when the live amount is missing or the read failed.
   * Cleared only when a fresh non-null free-shipping amount is observed.
   */
  shopifyObservationError: string | null;
  /** Profile / zone / rate that produced the last observed amount. */
  shopifyObservationSource: FreeShippingObservationSource | null;
  /** Non-fatal note when several distinct PT free-rate amounts were found. */
  shopifyObservationWarning: string | null;
};

export const DEFAULT_ANNOUNCEMENT_BAR_SETTING: AnnouncementBarSetting = {
  enabled: false,
  threshold: null,
  shopifySnapshot: null,
  shopifyObservationError: null,
  shopifyObservationSource: null,
  shopifyObservationWarning: null,
};
