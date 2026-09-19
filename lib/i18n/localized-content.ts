import type { Locale } from "./locales";

export type PersistedContentLocale = "EN" | "PT";

export function storefrontLocaleToContentLocale(locale: Locale): PersistedContentLocale {
  return locale === "pt" ? "PT" : "EN";
}

// "Blank" for a string means empty/whitespace; for JSON content (details,
// materialLexicon, legalSections, ...) it means null/undefined only — an
// object or array is content even if some of its own leaves are empty, and
// a plain string check can never see into it. Getting this wrong means an
// optional JSON field can never resolve to its translation (always falls
// back to source) and a required JSON field can never register as complete.
export function hasContent(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
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
      optional.has(key) && !hasContent(value)
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
  const missing = requiredFields.filter((field) => !hasContent(content[field]));
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
