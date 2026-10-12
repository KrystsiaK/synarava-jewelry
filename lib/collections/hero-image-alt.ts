import type { Locale } from "@/lib/i18n/locales";

/**
 * Per-collection hero image alt for one locale (Synarava CMS only).
 * Empty locale overlays fall back to English, then to the collection name.
 */
export function resolveCollectionHeroImageAlt(
  collection: {
    name: string;
    heroImageAlt?: string | null;
    translations?: Array<{ locale: string; heroImageAlt?: string | null; name?: string }>;
  },
  locale: Locale,
): string {
  if (locale === "en") {
    return collection.heroImageAlt?.trim() || collection.name;
  }
  const overlay = collection.translations?.find((row) => row.locale === locale);
  const localized = overlay?.heroImageAlt?.trim();
  if (localized) return localized;
  const english = collection.heroImageAlt?.trim();
  if (english) return english;
  return overlay?.name?.trim() || collection.name;
}
