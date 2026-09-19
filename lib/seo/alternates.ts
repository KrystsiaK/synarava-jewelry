import { SUPPORTED_LOCALES, type Locale } from "@/lib/i18n/locales";
import { localePath } from "@/lib/i18n/routing";

export function buildAlternates(locale: Locale, path: string, localizedPaths?: Partial<Record<Locale, string>>) {
  const languages = Object.fromEntries(
    SUPPORTED_LOCALES.map(({ code }) => [code, localePath(code, localizedPaths?.[code] ?? path)]),
  ) as Record<string, string>;
  languages["x-default"] = localePath("en", localizedPaths?.en ?? path);

  return {
    canonical: localePath(locale, localizedPaths?.[locale] ?? path),
    languages,
  };
}
