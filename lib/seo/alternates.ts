import { getPublishedStorefrontLocales } from "@/lib/i18n/storefront-locale-cache";
import type { Locale } from "@/lib/i18n/locales";
import { localePath } from "@/lib/i18n/routing";

export async function buildAlternates(
  locale: Locale,
  path: string,
  localizedPaths?: Partial<Record<string, string>>,
) {
  const locales = await getPublishedStorefrontLocales();
  const defaultSegment = locales.find((entry) => entry.isDefault)?.routeSegment ?? "en";

  const languages = Object.fromEntries(
    locales.map(({ routeSegment }) => [routeSegment, localePath(routeSegment, localizedPaths?.[routeSegment] ?? path)]),
  ) as Record<string, string>;
  languages["x-default"] = localePath(defaultSegment, localizedPaths?.[defaultSegment] ?? path);

  return {
    canonical: localePath(locale, localizedPaths?.[locale] ?? path),
    languages,
  };
}
