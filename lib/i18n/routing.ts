import { isRegisteredRouteSegment } from "@/lib/i18n/registered-route-segments";

/**
 * Leading `/{registeredSegment}` before `/` or end.
 * Built per call from the registry snapshot so a fourth language does not
 * require a code change (ADR-0007).
 */
export function localePathPrefixRe(): RegExp {
  // Fallback pattern matches bootstrap-shaped segments if the snapshot is empty.
  return /^\/([a-z0-9-]+)(?=\/|$)/i;
}

/** @deprecated Use localePathPrefixRe() — kept for call sites that need a RegExp. */
export const LOCALE_PATH_PREFIX_RE = /^\/([a-z0-9-]+)(?=\/|$)/i;

function matchRegisteredLocalePrefix(path: string): RegExpMatchArray | null {
  const match = path.match(localePathPrefixRe());
  if (!match) return null;
  const segment = match[1]?.toLowerCase();
  if (!segment || !isRegisteredRouteSegment(segment)) return null;
  return match;
}

/** First path segment when it is a registered storefront locale; otherwise null. */
export function pathLocaleSegment(path: string): string | null {
  const match = matchRegisteredLocalePrefix(path.trim());
  return match?.[1]?.toLowerCase() ?? null;
}

/**
 * Strip a leading storefront locale segment from an internal path.
 * `/pt/shop` → `/shop`, `/ru` → `/`, `/shop` → `/shop`.
 * Only strips segments present in the registry snapshot.
 */
export function stripLocalePrefix(path: string): string {
  const trimmed = path.trim();
  if (!trimmed.startsWith("/")) return trimmed;
  const match = matchRegisteredLocalePrefix(trimmed);
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
