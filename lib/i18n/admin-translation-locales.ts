import "server-only";

import { getStorefrontLocales } from "@/lib/i18n/storefront-locale-cache";

export type AdminTranslationLocale = { code: string; label: string };

/**
 * Every non-English registered locale, for admin editors to render a tab
 * for — registered, not just published: staff should be able to prep a
 * translation before the locale goes live. Adding a locale to the registry
 * (Task U1) is enough to make it editable here; no editor code changes.
 */
export async function getAdminTranslationLocales(): Promise<AdminTranslationLocale[]> {
  const locales = await getStorefrontLocales();
  // `code` here must be the registry's own locale code — the exact string
  // stored in ProductTranslation.locale / CollectionTranslation.locale /
  // PageTranslation.locale and used to build FormData field names
  // (adminLocaleFieldName). routeSegment is a URL detail that can change
  // independently of the locale code, so using it here would silently
  // read/write the wrong translation row the day the two ever diverge.
  return locales
    .filter((locale) => !locale.isDefault)
    .map((locale) => ({ code: locale.code, label: locale.nativeName }));
}
