import type { Locale } from "./locales";
import { SHOPIFY_PORTUGUESE_STOREFRONT_LANGUAGE } from "@/lib/shopify/locales";

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

const SHOPIFY_STOREFRONT_LANGUAGE_CODES: Record<Locale, string> = {
  en: "EN",
  pt: SHOPIFY_PORTUGUESE_STOREFRONT_LANGUAGE,
  ru: "RU",
};

export function shopifyLanguage(locale: Locale) {
  return SHOPIFY_STOREFRONT_LANGUAGE_CODES[locale];
}
