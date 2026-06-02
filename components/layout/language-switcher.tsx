"use client";

import { Globe, Check, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "@/lib/i18n/context";

const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "ar", name: "العربية" },
  { code: "bg", name: "Български" },
  { code: "cs", name: "Čeština" },
  { code: "da", name: "Dansk" },
  { code: "de", name: "Deutsch" },
  { code: "el", name: "Ελληνικά" },
  { code: "es", name: "Español" },
  { code: "et", name: "Eesti" },
  { code: "fi", name: "Suomi" },
  { code: "fr", name: "Français" },
  { code: "hu", name: "Magyar" },
  { code: "id", name: "Bahasa Indonesia" },
  { code: "it", name: "Italiano" },
  { code: "ja", name: "日本語" },
  { code: "ko", name: "한국어" },
  { code: "lt", name: "Lietuvių" },
  { code: "lv", name: "Latviešu" },
  { code: "nb", name: "Norsk" },
  { code: "nl", name: "Nederlands" },
  { code: "pl", name: "Polski" },
  { code: "pt", name: "Português" },
  { code: "ro", name: "Română" },
  { code: "ru", name: "Русский" },
  { code: "sk", name: "Slovenčina" },
  { code: "sl", name: "Slovenščina" },
  { code: "sv", name: "Svenska" },
  { code: "tr", name: "Türkçe" },
  { code: "uk", name: "Українська" },
  { code: "zh", name: "中文" },
];

export function LanguageSwitcher() {
  const { locale, setLocale, loading, t } = useTranslations();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  async function handleSelect(code: string) {
    setOpen(false);
    if (code !== locale) await setLocale(code);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("language.select")}
        aria-expanded={open}
        className="inline-flex size-9 items-center justify-center border border-foreground/10 text-muted transition-colors hover:border-foreground/25 hover:text-foreground"
      >
        {loading ? (
          <Loader2 size={15} className="animate-spin" />
        ) : (
          <Globe size={15} />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 max-h-72 w-48 overflow-y-auto border border-stroke bg-background shadow-lg [scrollbar-width:thin]">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              type="button"
              onClick={() => handleSelect(lang.code)}
              className="flex w-full items-center justify-between px-4 py-2.5 text-left font-mono text-[0.72rem] uppercase tracking-[0.1em] transition-colors hover:bg-foreground/5"
            >
              <span className={locale === lang.code ? "text-foreground" : "text-muted"}>
                {lang.name}
              </span>
              {locale === lang.code && <Check size={12} className="shrink-0 text-accent" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
