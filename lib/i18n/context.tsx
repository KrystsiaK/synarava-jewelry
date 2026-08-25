"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import en from "@/messages/en.json";
import { flattenMessages } from "./utils";
import { normalizeLocale, type Locale } from "./locales";

export type { Locale } from "./locales";

type TranslationContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => Promise<void>;
  t: (key: string, values?: TranslationValues) => string;
  plural: (key: string, count: number, values?: TranslationValues) => string;
  loading: boolean;
};

type TranslationValues = Record<string, string | number>;

const STORAGE_LOCALE_KEY = "synarava-locale";
const STORAGE_CACHE_PREFIX = "synarava-t-v4-";

const enFlat = flattenMessages(en as Record<string, unknown>);

const TranslationContext = createContext<TranslationContextValue>({
  locale: "en",
  setLocale: async () => {},
  t: (key, values) => interpolate(enFlat[key] ?? key, values),
  plural: (key, count, values) => interpolate(enFlat[`${key}.${count === 1 ? "one" : "other"}`] ?? key, { ...values, count }),
  loading: false,
});

export function TranslationProvider({
  initialLocale = "en",
  children,
}: {
  initialLocale?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [locale, setLocaleState] = useState<Locale>(() => normalizeLocale(initialLocale));
  const [messages, setMessages] = useState<Record<string, string>>(enFlat);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const normalizedLocale = normalizeLocale(initialLocale);
    if (normalizedLocale !== "en") {
      loadLocale(normalizedLocale);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadLocale(newLocale: Locale): Promise<void> {
    if (newLocale === "en") {
      setLocaleState("en");
      setMessages(enFlat);
      persist("en");
      document.documentElement.lang = "en";
      router.refresh();
      return;
    }

    const cached = readCache(newLocale);
    if (cached) {
      setLocaleState(newLocale);
      setMessages(cached);
      persist(newLocale);
      document.documentElement.lang = newLocale;
      router.refresh();
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/translate?locale=${encodeURIComponent(newLocale)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: Record<string, string> = await res.json();
      writeCache(newLocale, data);
      setMessages(data);
      setLocaleState(newLocale);
      persist(newLocale);
      document.documentElement.lang = newLocale;
      router.refresh();
    } catch (err) {
      console.error("[i18n] Failed to load translations:", err);
    } finally {
      setLoading(false);
    }
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
    <TranslationContext.Provider value={{ locale, setLocale: loadLocale, t, plural, loading }}>
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

function readCache(locale: Locale): Record<string, string> | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_CACHE_PREFIX}${locale}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCache(locale: Locale, data: Record<string, string>) {
  try {
    localStorage.setItem(`${STORAGE_CACHE_PREFIX}${locale}`, JSON.stringify(data));
  } catch {}
}
