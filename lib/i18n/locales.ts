import { isRegisteredRouteSegment } from "@/lib/i18n/registered-route-segments";

/**
 * Bootstrapped locales that ship with the app (seed rows + message files).
 * Not a routing allowlist — `StorefrontLocale` via the cached registry is the
 * source of truth (ADR-0006 / languages-as-data Part A).
 */
export const BOOTSTRAP_LOCALES = [
  { code: "en", name: "English" },
  { code: "pt", name: "Português" },
  { code: "ru", name: "Русский" },
] as const;

export const DEFAULT_LOCALE = "en" as const;

/**
 * @deprecated Prefer BOOTSTRAP_LOCALES or the registry. Alias kept so gradual
 * call-site migration does not break imports during Part A.
 */
export const SUPPORTED_LOCALES = BOOTSTRAP_LOCALES;

/** Storefront language code (registry `code` / URL `routeSegment`). */
export type Locale = string;

const BOOTSTRAP_CODES = new Set<string>(
  BOOTSTRAP_LOCALES.map((locale) => locale.code),
);

export function isSupportedLocale(value: unknown): value is Locale {
  return typeof value === "string" && BOOTSTRAP_CODES.has(value);
}

/**
 * Normalize a locale code for request/UI use. Accepts bootstrap codes and any
 * currently registered route segment; everything else falls back to English so
 * en/pt/ru behavior stays stable when an unknown value arrives.
 */
export function normalizeLocale(value: unknown): Locale {
  if (typeof value !== "string") return DEFAULT_LOCALE;
  const code = value.trim().toLowerCase();
  if (!code) return DEFAULT_LOCALE;
  if (BOOTSTRAP_CODES.has(code) || isRegisteredRouteSegment(code)) return code;
  return DEFAULT_LOCALE;
}
