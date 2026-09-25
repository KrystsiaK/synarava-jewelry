export function localePath(locale: string, path: string) {
  return path === "/" ? `/${locale}` : `/${locale}${path}`;
}

/** Prefixes an internal storefront path; leaves absolute URLs untouched. */
export function storefrontHref(locale: string, href: string) {
  const trimmed = href.trim();
  if (!trimmed) return localePath(locale, "/");
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("mailto:")) return trimmed;
  return localePath(locale, trimmed.startsWith("/") ? trimmed : `/${trimmed}`);
}
