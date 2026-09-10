import type { Locale } from "@/lib/i18n/locales";
import {
  contentCompleteness,
  storefrontLocaleToContentLocale,
} from "@/lib/i18n/localized-content";

export type PostTranslationRecord = {
  locale: "EN" | "PT";
  title: string;
  excerpt?: string | null;
  body?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  reviewStatus: "DRAFT" | "REVIEWED";
};

const REQUIRED_POST_FIELDS: Array<"title" | "excerpt" | "body"> = ["title", "excerpt", "body"];

export function resolvePostTranslation<T extends PostTranslationRecord>(
  translations: T[],
  locale: Locale,
) {
  const persistedLocale = storefrontLocaleToContentLocale(locale);
  return translations.find((translation) => translation.locale === persistedLocale) ?? null;
}

export function postLocaleReadiness(
  translations: PostTranslationRecord[],
  locale: Locale,
) {
  const translation = resolvePostTranslation(translations, locale);
  const completeness = contentCompleteness(
    translation ?? { locale: storefrontLocaleToContentLocale(locale), title: "", excerpt: "", body: "", reviewStatus: "DRAFT" },
    REQUIRED_POST_FIELDS,
  );
  return {
    complete: completeness.complete,
    reviewed: translation?.reviewStatus === "REVIEWED",
    percent: completeness.percent,
    missing: completeness.missing,
  };
}

export function validatePostPublication({
  translations,
}: {
  translations: PostTranslationRecord[];
}) {
  return (["en", "pt"] as const).flatMap((locale) => {
    const label = locale === "en" ? "English" : "Portuguese";
    const readiness = postLocaleReadiness(translations, locale);
    return [
      ...readiness.missing.map((field) => `${label} ${String(field)}`),
      ...(readiness.reviewed ? [] : [`${label} review`]),
    ];
  });
}
