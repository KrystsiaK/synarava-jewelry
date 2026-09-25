"use client";

import { ArtifactButton } from "@/components/ui/artifact-button";
import { ConsentToggle } from "@/components/privacy/consent-toggle";
import { useTranslations } from "@/lib/i18n/context";
import type { PrivacyConsentChoices } from "@/lib/privacy/consent";

export type CookiePreferencesFormProps = {
  value: PrivacyConsentChoices;
  onChange: (next: PrivacyConsentChoices) => void;
  onSave: (choices: PrivacyConsentChoices) => void;
  onRejectAll: () => void;
  /** Heading element id — required when the form is inside a labelled dialog. */
  titleId?: string;
  /** Visual density: modal keeps compact chrome; page uses the same copy with roomier spacing. */
  variant?: "modal" | "page";
};

/**
 * Shared cookie preference controls — used by the first-visit modal and
 * the `/cookie-settings` page. Wrappers own chrome + persistence only.
 */
export function CookiePreferencesForm({
  value,
  onChange,
  onSave,
  onRejectAll,
  titleId = "privacy-preferences-title",
  variant = "modal",
}: CookiePreferencesFormProps) {
  const { t } = useTranslations();
  const Heading = variant === "page" ? "h1" : "h2";
  const headingClass =
    variant === "page"
      ? "mt-3 font-serif text-[2.4rem] leading-tight md:text-[3rem]"
      : "mt-3 font-serif text-3xl leading-tight";

  return (
    <div data-component="CookiePreferencesForm">
      <p className="label-mono text-accent">{t("privacyConsent.eyebrow")}</p>
      <Heading id={titleId} className={headingClass}>
        {t("privacyConsent.preferencesTitle")}
      </Heading>
      <p className="mt-3 text-sm leading-6 text-foreground/70 md:text-base">
        {t("privacyConsent.preferencesDescription")}
      </p>
      <div className="mt-6 border-y border-stroke">
        <ConsentToggle
          checked
          disabled
          label={t("privacyConsent.necessaryTitle")}
          description={t("privacyConsent.necessaryDescription")}
        />
        <ConsentToggle
          checked={value.preferences}
          onChange={(preferences) => onChange({ ...value, preferences })}
          label={t("privacyConsent.preferenceTitle")}
          description={t("privacyConsent.preferenceDescription")}
        />
        <ConsentToggle
          checked={value.analytics}
          onChange={(analytics) => onChange({ ...value, analytics })}
          label={t("privacyConsent.analyticsTitle")}
          description={t("privacyConsent.analyticsDescription")}
        />
        <ConsentToggle
          checked={value.marketing}
          onChange={(marketing) => onChange({ ...value, marketing })}
          label={t("privacyConsent.marketingTitle")}
          description={t("privacyConsent.marketingDescription")}
        />
      </div>
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <ArtifactButton size="sm" variant="secondary" onClick={onRejectAll}>
          {t("privacyConsent.rejectAll")}
        </ArtifactButton>
        <ArtifactButton size="sm" variant="primary" onClick={() => onSave(value)}>
          {t("privacyConsent.save")}
        </ArtifactButton>
      </div>
    </div>
  );
}
