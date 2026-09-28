import { localeTag } from "@/lib/i18n/format";
import { normalizeLocale, type Locale } from "@/lib/i18n/locales";
import { getPublishedStorefrontLocales } from "@/lib/i18n/storefront-locale-cache";

/** Open Graph `og:locale` uses underscore regions (`en_IE`), not BCP-47 hyphens. */
export function toOpenGraphLocale(locale: Locale): string {
  return localeTag(locale).replaceAll("-", "_");
}

/**
 * Current + alternate OG locales from published storefront locales.
 * Spread into every `openGraph` block — Next replaces parent openGraph wholesale.
 */
export async function buildOpenGraphLocales(locale: Locale) {
  const current = toOpenGraphLocale(normalizeLocale(locale));
  const published = await getPublishedStorefrontLocales();
  const alternateLocale = [
    ...new Set(
      published.map((entry) => toOpenGraphLocale(normalizeLocale(entry.routeSegment))),
    ),
  ].filter((tag) => tag !== current);

  return {
    locale: current,
    alternateLocale,
  };
}
