import type { Locale } from "@/lib/i18n/locales";

/**
 * Per-collection hero CTA label for one locale.
 * Empty locale overlays do not inherit English — storefront then uses the
 * Collections page `detailShopLabel` chrome, then `messages` dictionary.
 */
export function resolveCollectionCtaLabel(
  collection: {
    ctaLabel?: string | null;
    translations?: Array<{ locale: string; ctaLabel?: string | null }>;
  },
  locale: Locale,
): string {
  if (locale === "en") return collection.ctaLabel?.trim() ?? "";
  const overlay = collection.translations?.find((row) => row.locale === locale)?.ctaLabel;
  return overlay?.trim() ?? "";
}

/**
 * Hero primary CTA from CMS layers only.
 * Returns undefined when both are empty so the storefront dictionary can fill in.
 */
export function resolveCollectionHeroCtaLabel({
  collectionCtaLabel,
  pageDetailShopLabel,
}: {
  collectionCtaLabel?: string | null;
  pageDetailShopLabel?: string | null;
}): string | undefined {
  const perCollection = collectionCtaLabel?.trim();
  if (perCollection) return perCollection;
  const globalChrome = pageDetailShopLabel?.trim();
  if (globalChrome) return globalChrome;
  return undefined;
}
