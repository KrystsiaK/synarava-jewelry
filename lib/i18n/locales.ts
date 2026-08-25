export const SUPPORTED_LOCALES = [
  { code: "en", name: "English" },
  { code: "pt", name: "Português" },
] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number]["code"];

export function isSupportedLocale(value: unknown): value is Locale {
  return typeof value === "string"
    && SUPPORTED_LOCALES.some((locale) => locale.code === value);
}

export function normalizeLocale(value: unknown): Locale {
  return isSupportedLocale(value) ? value : "en";
}
