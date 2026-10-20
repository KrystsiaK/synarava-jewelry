"use client";

import { createContext, useCallback, useContext, useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BOOTSTRAP_LOCALES, normalizeLocale, type Locale } from "./locales";
import { getEnglishMessages, getFlatMessages, listBundledMessageLocales } from "./message-catalog";
import { glueOrphanPunctuation } from "@/lib/text/glue-orphan-punctuation";
import { localePath, pathLocaleSegment, stripLocalePrefix } from "./routing";
import { setRegisteredRouteSegments } from "./registered-route-segments";

export type { Locale } from "./locales";

export type AvailableLocale = { code: string; name: string };

type TranslationContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, values?: TranslationValues) => string;
  plural: (key: string, count: number, values?: TranslationValues) => string;
  loading: boolean;
  availableLocales: readonly AvailableLocale[];
};

type TranslationValues = Record<string, string | number>;

const STORAGE_LOCALE_KEY = "synarava-locale";

// Bundled dictionaries ship in the client bundle already, so a locale switch
// never waits on a fetch. Locales without a catalog entry fall back to English
// per key (ADR-0006 A8).
const enFlat = getEnglishMessages();
const dictionaries: Partial<Record<string, Record<string, string>>> = Object.fromEntries(
  listBundledMessageLocales().map((code) => [code, getFlatMessages(code)]),
);

const TranslationContext = createContext<TranslationContextValue>({
  locale: "en",
  setLocale: () => {},
  t: (key, values) => interpolate(enFlat[key] ?? key, values),
  plural: (key, count, values) => interpolate(enFlat[`${key}.${count === 1 ? "one" : "other"}`] ?? key, { ...values, count }),
  loading: false,
  availableLocales: BOOTSTRAP_LOCALES,
});

export function TranslationProvider({
  initialLocale = "en",
  initialOverrides,
  availableLocales = BOOTSTRAP_LOCALES,
  children,
}: {
  initialLocale?: string;
  initialOverrides?: Record<string, Record<string, string>>;
  availableLocales?: readonly AvailableLocale[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  // Keep client path helpers in sync with the registry-backed switcher list
  // (plus bootstrap) so stripLocalePrefix never treats /shop as a locale.
  const segmentCodes = useMemo(() => {
    const codes = new Set<string>(BOOTSTRAP_LOCALES.map((locale) => locale.code));
    for (const locale of availableLocales) codes.add(locale.code);
    return [...codes];
  }, [availableLocales]);

  useEffect(() => {
    setRegisteredRouteSegments(segmentCodes);
  }, [segmentCodes]);

  // The URL is the single source of truth for locale (REV-21) — a useState here
  // survives client-side navigation (root layout never remounts), so browser
  // back/forward or a plain Link to a /pt/... route used to leave the previous
  // locale's dictionary in place. Deriving from pathname on every render means
  // there's no stored locale to go stale: it's re-read on every navigation.
  const pathLocale = pathLocaleSegment(pathname);
  const locale = normalizeLocale(pathLocale ?? initialLocale);
  const messages = useMemo(
    () => ({ ...dictionaries[locale], ...initialOverrides?.[locale] }),
    [locale, initialOverrides],
  );

  useEffect(() => {
    document.documentElement.lang = locale;
    persist(locale);
  }, [locale]);

  function setLocale(newLocale: Locale) {
    // Keeps the filtered/sectioned context the user is in (e.g. a shop query
    // string or a profile tab anchor) across the switch instead of dropping it
    // (REV-22). Read directly from window rather than useSearchParams(), which
    // would force this whole subtree (the root layout wraps every page) out of
    // static rendering — setLocale only ever runs from a click handler, never
    // during render, so this is safe.
    const rest = stripLocalePrefix(pathname);
    const { search, hash } = window.location;
    router.push(`${localePath(newLocale, rest === "" ? "/" : rest)}${search}${hash}`);
  }

  const t = useCallback(
    (key: string, values?: TranslationValues) => interpolate(messages[key] ?? enFlat[key] ?? key, values),
    [messages],
  );

  const plural = useCallback(
    (key: string, count: number, values?: TranslationValues) => {
      const category = new Intl.PluralRules(locale).select(count);
      return interpolate(
        messages[`${key}.${category}`] ?? messages[`${key}.other`] ?? enFlat[`${key}.${category}`] ?? enFlat[`${key}.other`] ?? key,
        { ...values, count },
      );
    },
    [locale, messages],
  );

  return (
    <TranslationContext.Provider value={{ locale, setLocale, t, plural, loading: false, availableLocales }}>
      {children}
    </TranslationContext.Provider>
  );
}

function interpolate(message: string, values?: TranslationValues) {
  const filled = !values
    ? message
    : message.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key: string) => (
        Object.hasOwn(values, key) ? String(values[key]) : match
      ));
  // Storefront + admin chrome copy share this path — glue orphan punctuation
  // at render so middots/dashes never start a line in UI strings.
  return glueOrphanPunctuation(filled);
}

export function useTranslations() {
  return useContext(TranslationContext);
}

function persist(locale: Locale) {
  try {
    localStorage.setItem(STORAGE_LOCALE_KEY, locale);
    document.cookie = `synarava-locale=${locale}; path=/; max-age=31536000; SameSite=Lax`;
  } catch {}
}
