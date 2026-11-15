// Review moderation toggles. Client-safe. Stored in SiteSetting `product-reviews-settings-v1`.
// Section copy (EN/PT/RU) lives in storefront-copy (Shared → Reviews) — do not duplicate.

export const PRODUCT_REVIEWS_SETTINGS_KEY = "product-reviews-settings-v1";

export type ProductReviewsSettings = {
  /**
   * When true (default), new submissions stay PENDING until an admin publishes.
   * When false, submissions go straight to PUBLISHED.
   */
  moderationBeforePublish: boolean;
};

export const PRODUCT_REVIEWS_SETTINGS_DEFAULTS: ProductReviewsSettings = {
  moderationBeforePublish: true,
};

export const PRODUCT_REVIEWS_SETTINGS_FIELD_DEFS: Array<{
  key: keyof ProductReviewsSettings;
  label: string;
  hint: string;
}> = [
  {
    key: "moderationBeforePublish",
    label: "Moderation before publish",
    hint: "On by default. When off, new reviews appear on the storefront immediately as PUBLISHED.",
  },
];
