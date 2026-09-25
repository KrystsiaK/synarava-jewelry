"use client";

import Link from "next/link";

import { useTranslations } from "@/lib/i18n/context";
import { localePath } from "@/lib/i18n/routing";

/** Footer control — navigates to the shared cookie settings page. */
export function PrivacySettingsButton() {
  const { t, locale } = useTranslations();

  return (
    <Link
      data-component="PrivacySettingsButton"
      href={localePath(locale, "/cookie-settings")}
      className="label-mono text-muted underline decoration-transparent underline-offset-4 transition-colors hover:text-foreground hover:decoration-current focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-couture-red"
    >
      {t("footer.cookieSettings")}
    </Link>
  );
}
