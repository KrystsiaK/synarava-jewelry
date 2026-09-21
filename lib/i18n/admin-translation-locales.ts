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
  return locales
    .filter((locale) => !locale.isDefault)
    .map((locale) => ({ code: locale.routeSegment, label: locale.nativeName }));
}
