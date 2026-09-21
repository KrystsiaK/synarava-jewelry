/**
 * Maps a locale + field key to the FormData field name admin editors use:
 * the source locale's fields are unprefixed ("title"), every other locale
 * prefixes and capitalizes ("title" -> "ptTitle", "legal:x:title" ->
 * "ptLegal:x:title"). Shared by the client (building hidden mirror fields)
 * and the server (reading them back) so they can never drift apart —
 * adding a locale never means touching either side's field list, only
 * iterating over one more locale code.
 */
export function adminLocaleFieldName(locale: string, key: string, sourceLocale = "en"): string {
  if (locale === sourceLocale) return key;
  return `${locale}${key.charAt(0).toUpperCase()}${key.slice(1)}`;
}

/** Reads a string field for `locale` out of FormData, using the same naming `adminLocaleFieldName` builds. */
export function readLocaleField(formData: FormData, locale: string, key: string, sourceLocale = "en"): string {
  const value = formData.get(adminLocaleFieldName(locale, key, sourceLocale));
  return typeof value === "string" ? value.trim() : "";
}
