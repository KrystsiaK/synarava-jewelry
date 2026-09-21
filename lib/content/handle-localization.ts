import type { Locale } from "@/lib/i18n/locales";

export type LocalizedHandleEntityType = "PRODUCT" | "COLLECTION" | "PAGE";

export function resolveLocalizedHandle(locale: Locale, sourceSlug: string, localizedHandle?: string | null) {
  const translated = localizedHandle?.trim();
  return locale !== "en" && translated ? translated : sourceSlug;
}

export function shouldRedirectLocalizedHandle(locale: Locale, requested: string, activeHandle: string) {
  return locale !== "en" && requested !== activeHandle;
}
