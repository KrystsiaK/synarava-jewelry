import type { Locale } from "./locales";

export type PersistedContentLocale = "EN" | "PT";

export function storefrontLocaleToContentLocale(locale: Locale): PersistedContentLocale {
  return locale === "pt" ? "PT" : "EN";
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function resolveLocalizedContent<T extends Record<string, unknown>>({
  source,
  translation,
  optionalFields = [],
}: {
  source: T;
  translation?: Partial<T> | null;
  optionalFields?: Array<keyof T>;
}): T {
  if (!translation) return { ...source };

  const optional = new Set<keyof T>(optionalFields);
  const localized = { ...source };
  for (const key of Object.keys(source) as Array<keyof T>) {
    const value = translation[key];
    localized[key] = (
      optional.has(key) && !hasText(value)
        ? source[key]
        : value ?? source[key]
    ) as T[keyof T];
  }
  return localized;
}

export function contentCompleteness<T extends Record<string, unknown>>(
  content: T,
  requiredFields: Array<keyof T>,
) {
  const missing = requiredFields.filter((field) => !hasText(content[field]));
  const total = requiredFields.length;
  const completed = total - missing.length;
  return {
    complete: missing.length === 0,
    completed,
    total,
    percent: total === 0 ? 100 : Math.round((completed / total) * 100),
    missing,
  };
}
