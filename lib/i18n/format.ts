import type { Locale } from "./locales";

const NUMBER_LOCALES: Record<Locale, string> = {
  en: "en-IE",
  pt: "pt-PT",
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

export function shopifyLanguage(locale: Locale) {
  return locale === "pt" ? "PT" : "EN";
}
