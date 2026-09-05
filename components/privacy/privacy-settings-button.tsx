"use client";

import { OPEN_PRIVACY_PREFERENCES_EVENT } from "@/lib/privacy/consent";
import { useTranslations } from "@/lib/i18n/context";

export function PrivacySettingsButton() {
  const { t } = useTranslations();

  return (
    <button
      type="button"
      className="label-mono text-muted underline decoration-transparent underline-offset-4 transition-colors hover:text-foreground hover:decoration-current focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-couture-red"
      onClick={() => window.dispatchEvent(new Event(OPEN_PRIVACY_PREFERENCES_EVENT))}
    >
      {t("footer.cookieSettings")}
    </button>
  );
}
