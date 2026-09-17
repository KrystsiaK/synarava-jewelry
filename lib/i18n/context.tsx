"use client";

import { createContext, useCallback, useContext, useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import en from "@/messages/en.json";
import pt from "@/messages/pt.json";
import { flattenMessages } from "./utils";
import { normalizeLocale, type Locale } from "./locales";
import { localePath } from "./routing";

export type { Locale } from "./locales";

type TranslationContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, values?: TranslationValues) => string;
  plural: (key: string, count: number, values?: TranslationValues) => string;
  loading: boolean;
};

type TranslationValues = Record<string, string | number>;

const STORAGE_LOCALE_KEY = "synarava-locale";

const enFlat = flattenMessages(en as Record<string, unknown>);
// Both supported dictionaries ship in the client bundle already (the same
// source the old /api/translate route re-served over the network), so a
// locale switch — and, critically, the very first SSR render — never has to
// wait on a fetch. REV-20: SSR used to seed `messages` from enFlat
// unconditionally and only fetch the PT dictionary in a post-mount effect,
// so a PT page's initial HTML was English until that fetch resolved.
const dictionaries: Record<Locale, Record<string, string>> = {
  en: enFlat,
  pt: flattenMessages(pt as Record<string, unknown>),
};

const TranslationContext = createContext<TranslationContextValue>({
  locale: "en",
  setLocale: () => {},
  t: (key, values) => interpolate(enFlat[key] ?? key, values),
  plural: (key, count, values) => interpolate(enFlat[`${key}.${count === 1 ? "one" : "other"}`] ?? key, { ...values, count }),
  loading: false,
});

export function TranslationProvider({
  initialLocale = "en",
  initialOverrides,
  children,
}: {
  initialLocale?: string;
  initialOverrides?: { en: Record<string, string>; pt: Record<string, string> };
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  // The URL is the single source of truth for locale (REV-21) — a useState here
  // survives client-side navigation (root layout never remounts), so browser
  // back/forward or a plain Link to a /pt/... route used to leave the previous
  // locale's dictionary in place. Deriving from pathname on every render means
  // there's no stored locale to go stale: it's re-read on every navigation.
  const pathLocale = pathname.match(/^\/(en|pt)(?=\/|$)/)?.[1];
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
    const rest = pathname.replace(/^\/(en|pt)(?=\/|$)/, "");
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
    <TranslationContext.Provider value={{ locale, setLocale, t, plural, loading: false }}>
      {children}
    </TranslationContext.Provider>
  );
}

function interpolate(message: string, values?: TranslationValues) {
  if (!values) return message;
  return message.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key: string) => (
    Object.hasOwn(values, key) ? String(values[key]) : match
  ));
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
