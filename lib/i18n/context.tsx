"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import en from "@/messages/en.json";
import { flattenMessages } from "./utils";

export type Locale = string;

type TranslationContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => Promise<void>;
  t: (key: string) => string;
  loading: boolean;
};

const STORAGE_LOCALE_KEY = "synarava-locale";
const STORAGE_CACHE_PREFIX = "synarava-t-";

const enFlat = flattenMessages(en as Record<string, unknown>);

const TranslationContext = createContext<TranslationContextValue>({
  locale: "en",
  setLocale: async () => {},
  t: (key) => enFlat[key] ?? key,
  loading: false,
});

export function TranslationProvider({
  initialLocale = "en",
  children,
}: {
  initialLocale?: string;
  children: React.ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const [messages, setMessages] = useState<Record<string, string>>(enFlat);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialLocale && initialLocale !== "en") {
      loadLocale(initialLocale);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadLocale(newLocale: Locale): Promise<void> {
    if (newLocale === "en") {
      setLocaleState("en");
      setMessages(enFlat);
      persist("en");
      return;
    }

    const cached = readCache(newLocale);
    if (cached) {
      setLocaleState(newLocale);
      setMessages(cached);
      persist(newLocale);
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
    } catch (err) {
      console.error("[i18n] Failed to load translations:", err);
    } finally {
      setLoading(false);
    }
  }

  const t = useCallback(
    (key: string) => messages[key] ?? enFlat[key] ?? key,
    [messages],
  );

  return (
    <TranslationContext.Provider value={{ locale, setLocale: loadLocale, t, loading }}>
      {children}
    </TranslationContext.Provider>
  );
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
