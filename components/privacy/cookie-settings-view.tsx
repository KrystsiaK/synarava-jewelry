"use client";

import Link from "next/link";
import { useState } from "react";

import { CookiePreferencesForm } from "@/components/privacy/cookie-preferences-form";
import { useTranslations } from "@/lib/i18n/context";
import { localePath } from "@/lib/i18n/routing";
import {
  parsePrivacyConsent,
  type PrivacyConsent,
  type PrivacyConsentChoices,
} from "@/lib/privacy/consent";
import {
  DEFAULT_PRIVACY_CHOICES,
  persistPrivacyConsent,
} from "@/lib/privacy/consent-persistence";

/**
 * Page wrapper around the shared {@link CookiePreferencesForm}.
 * Persistence matches the first-visit modal via `persistPrivacyConsent`.
 */
export function CookieSettingsView({ initialConsent }: { initialConsent?: string }) {
  const { t, locale } = useTranslations();
  const [consent, setConsent] = useState<PrivacyConsent | null>(() => parsePrivacyConsent(initialConsent));
  const [draft, setDraft] = useState<PrivacyConsentChoices>(() => consent ?? DEFAULT_PRIVACY_CHOICES);
  const [savedFlash, setSavedFlash] = useState(false);

  function save(choices: PrivacyConsentChoices) {
    const next = persistPrivacyConsent(choices, consent);
    setConsent(next);
    setDraft(next);
    setSavedFlash(true);
  }

  return (
    <main data-component="CookieSettingsView" className="artifact-shell min-h-screen bg-background pb-24 pt-32 text-foreground md:pt-40">
      <div className="site-shell max-w-2xl">
        <CookiePreferencesForm
          variant="page"
          titleId="cookie-settings-form-title"
          value={draft}
          onChange={setDraft}
          onSave={save}
          onRejectAll={() => save(DEFAULT_PRIVACY_CHOICES)}
        />
        {savedFlash ? (
          <p className="mt-4 text-sm text-foreground/70" role="status">
            {t("cookieSettings.saved")}
          </p>
        ) : null}
        <p className="mt-10 border-t border-stroke pt-8">
          <Link
            href={localePath(locale, "/privacy")}
            className="label-caps text-muted transition-colors hover:text-foreground"
          >
            {t("cookieSettings.backToPrivacy")}
          </Link>
        </p>
      </div>
    </main>
  );
}
