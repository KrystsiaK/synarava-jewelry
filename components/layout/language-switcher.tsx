"use client";

import { Globe, Check, Loader2 } from "lucide-react";
import { useState } from "react";
import { AdaptivePopover } from "@/components/ui/adaptive-popover";
import { useTranslations } from "@/lib/i18n/context";
import { SUPPORTED_LOCALES, type Locale } from "@/lib/i18n/locales";

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
  const activeLanguage = SUPPORTED_LOCALES.find((lang) => lang.code === locale);

  async function handleSelect(code: Locale) {
    setOpen(false);
    if (code !== locale) await setLocale(code);
  }

  return (
    <div className={fullWidth ? "w-full" : undefined}>
      <AdaptivePopover
        open={open}
        onOpenChange={setOpen}
        align={align === "left" ? "start" : "end"}
        matchTriggerWidth={fullWidth}
        minWidth={192}
        role="listbox"
        ariaLabel={t("language.select")}
        className="border border-stroke bg-background py-1 shadow-[0_8px_20px_rgba(25,21,18,0.14)] [scrollbar-width:thin]"
        renderTrigger={(triggerProps) => (
          <button
            {...triggerProps}
            type="button"
            aria-label={t("language.select")}
            aria-haspopup="listbox"
            className={`inline-flex items-center justify-center text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent ${
              fullWidth
                ? "w-full justify-between gap-3 px-3 py-2.5"
                : showCode
                  ? "h-11 gap-2 px-3"
                  : "size-11"
            }`}
          >
            {loading ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Globe size={15} />
            )}
            {showCode ? (
              <span className="label-caps text-[0.72rem]">
                {activeLanguage?.code.toUpperCase() ?? "EN"}
              </span>
            ) : null}
          </button>
        )}
      >
          {SUPPORTED_LOCALES.map((lang) => (
            <button
              key={lang.code}
              type="button"
              role="option"
              aria-selected={locale === lang.code}
              onClick={() => handleSelect(lang.code)}
              className="flex min-h-11 w-full items-center justify-between px-4 py-2.5 text-left font-sans text-[0.72rem] uppercase tracking-[0.1em] transition-colors hover:bg-foreground/5"
            >
              <span className={locale === lang.code ? "text-foreground" : "text-muted"}>
                {lang.name}
              </span>
              {locale === lang.code && <Check size={12} className="shrink-0 text-accent" />}
            </button>
          ))}
      </AdaptivePopover>
    </div>
  );
}
