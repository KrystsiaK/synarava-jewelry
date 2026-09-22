// SHOPIFY_PORTUGUESE_ADMIN_LOCALE used to live here — every admin-side sync
// adapter now takes its locale from the StorefrontLocale registry instead
// (Task U5). SHOPIFY_PORTUGUESE_STOREFRONT_LANGUAGE remains: the buyer-facing
// Storefront API's @inContext(language:) still only knows English/Portuguese
// (lib/i18n/format.ts's shopifyLanguage()) — that's Task U6/U9's job, not U5's.
export const SHOPIFY_PORTUGUESE_STOREFRONT_LANGUAGE = "PT_PT" as const;
