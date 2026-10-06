import { SUPPORTED_LOCALES } from "@/lib/i18n/locales";

/** Leading `/en` | `/pt` | `/ru` (and any registered locale) before `/` or end. */
export const LOCALE_PATH_PREFIX_RE = new RegExp(
  `^/(${SUPPORTED_LOCALES.map((locale) => locale.code).join("|")})(?=/|$)`,
  "i",
);

/**
 * Strip a leading storefront locale segment from an internal path.
 * `/pt/shop` → `/shop`, `/ru` → `/`, `/shop` → `/shop`.
 */
export function stripLocalePrefix(path: string): string {
  const trimmed = path.trim();
  if (!trimmed.startsWith("/")) return trimmed;
  const match = trimmed.match(LOCALE_PATH_PREFIX_RE);
  if (!match) return trimmed;
  const rest = trimmed.slice(match[0].length);
  if (rest === "" || rest === "/") return "/";
  return rest.startsWith("/") ? rest : `/${rest}`;
}

/**
 * Canonical CMS / catalog form of an href: locale-free internal path.
 * Absolute `http(s):` and `mailto:` values are left unchanged.
 * Bare tokens (search names without `/`) are left alone — do not coerce them into paths.
 */
export function toLocaleFreeHref(href: string): string {
  const trimmed = href.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("mailto:")) return trimmed;
  if (!trimmed.startsWith("/")) return trimmed;
  return stripLocalePrefix(trimmed);
}

/**
 * Prefix a locale-free (or already-prefixed) storefront path with `locale`.
 * Idempotent: `localePath("pt", "/pt/shop")` → `/pt/shop`.
 */
export function localePath(locale: string, path: string) {
  const free = path === "/" || path === ""
    ? "/"
    : stripLocalePrefix(path.startsWith("/") ? path : `/${path}`);
  return free === "/" ? `/${locale}` : `/${locale}${free}`;
}

/** Prefixes an internal storefront path; leaves absolute URLs untouched. */
export function storefrontHref(locale: string, href: string) {
  const trimmed = href.trim();
  if (!trimmed) return localePath(locale, "/");
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("mailto:")) return trimmed;
  return localePath(locale, trimmed.startsWith("/") ? trimmed : `/${trimmed}`);
}
