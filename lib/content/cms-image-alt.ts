/** Trimmed CMS image alt, or empty string when unset (decorative). */
export function resolveCmsImageAlt(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

/**
 * Storefront alt for a CMS image: configured copy when present, otherwise
 * a short fallback (title/name). Never invents Shopify commerce media alt.
 */
export function cmsImageAltOrFallback(
  value: string | null | undefined,
  fallback: string,
): string {
  return resolveCmsImageAlt(value) || fallback.trim();
}
