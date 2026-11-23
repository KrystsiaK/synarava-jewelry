/** Audience-facing copy: English + European Portuguese. */
export type LocalizedCopy = {
  en: string;
  pt: string;
};

const EMPTY: LocalizedCopy = { en: "", pt: "" };

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Map DB / API values into `{ en, pt }`.
 * Legacy single-string rows (pre-migration) land in `en` unless `legacyLocale` is `pt`.
 */
export function normalizeLocalizedCopy(
  value: unknown,
  legacyLocale?: string | null,
): LocalizedCopy {
  if (value == null) return { ...EMPTY };
  if (typeof value === "string") {
    const text = value.trim();
    if (!text) return { ...EMPTY };
    if (legacyLocale === "pt") return { en: "", pt: text };
    return { en: text, pt: "" };
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    return {
      en: asTrimmedString(record.en),
      pt: asTrimmedString(record.pt),
    };
  }
  return { ...EMPTY };
}

export function localizedCopyNonEmpty(copy: LocalizedCopy): boolean {
  return Boolean(copy.en || copy.pt);
}

/** Flatten both locales for claim-guard scanning. */
export function localizedCopyBlob(copy: LocalizedCopy): string {
  return [copy.en, copy.pt].filter(Boolean).join("\n");
}
