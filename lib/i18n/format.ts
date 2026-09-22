import type { Locale } from "./locales";

const NUMBER_LOCALES: Record<Locale, string> = {
  en: "en-IE",
  pt: "pt-PT",
  ru: "ru-RU",
};

export function localeTag(locale: Locale) {
  return NUMBER_LOCALES[locale];
}

export function formatCurrency(
  amount: number,
  currency: string,
  locale: Locale,
) {
  return new Intl.NumberFormat(localeTag(locale), {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

// Shopify Storefront API LanguageCode enum values for each registered
// locale's @inContext(language:) argument — plain per-locale data, not a
// Portuguese-specific special case (Task U11).
const SHOPIFY_STOREFRONT_LANGUAGE_CODES: Record<Locale, string> = {
  en: "EN",
  pt: "PT_PT",
  ru: "RU",
};

export function shopifyLanguage(locale: Locale) {
  return SHOPIFY_STOREFRONT_LANGUAGE_CODES[locale];
}
