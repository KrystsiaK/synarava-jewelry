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

export function LanguageSwitcher({
  showCode = false,
  fullWidth = false,
  align = "right",
}: {
  showCode?: boolean;
  fullWidth?: boolean;
  align?: "left" | "right";
}) {
  const { locale, setLocale, loading, t } = useTranslations();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const activeLanguage = LANGUAGES.find((lang) => lang.code === locale);

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
    <div ref={ref} className={`relative ${fullWidth ? "w-full" : ""}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("language.select")}
        aria-expanded={open}
        className={`inline-flex items-center justify-center text-muted transition-colors hover:text-foreground ${
          fullWidth
            ? "w-full justify-between gap-3 px-3 py-2.5"
            : showCode
              ? "h-9 gap-2 px-3"
              : "size-9"
        }`}
      >
        {loading ? (
          <Loader2 size={15} className="animate-spin" />
        ) : (
          <Globe size={15} />
        )}
        {showCode ? (
          <span className="label-caps text-[0.72rem]">
            {activeLanguage?.code.toUpperCase() ?? locale.toUpperCase()}
          </span>
        ) : null}
      </button>

      {open && (
        <div
          className={`absolute top-full z-50 mt-1 max-h-72 overflow-y-auto border border-stroke bg-background shadow-lg [scrollbar-width:thin] ${
            fullWidth ? "left-0 w-full min-w-48" : "w-48"
          } ${align === "left" ? "left-0" : "right-0"}`}
        >
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              type="button"
              onClick={() => handleSelect(lang.code)}
              className="flex w-full items-center justify-between px-4 py-2.5 text-left font-sans text-[0.72rem] uppercase tracking-[0.1em] transition-colors hover:bg-foreground/5"
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
