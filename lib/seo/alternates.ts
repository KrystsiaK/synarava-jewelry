import { SUPPORTED_LOCALES, type Locale } from "@/lib/i18n/locales";
import { localePath } from "@/lib/i18n/routing";

export function buildAlternates(locale: Locale, path: string) {
  const languages = Object.fromEntries(
    SUPPORTED_LOCALES.map(({ code }) => [code, localePath(code, path)]),
  ) as Record<string, string>;
  languages["x-default"] = localePath("en", path);

  return {
    canonical: localePath(locale, path),
    languages,
  };
}
