export const PRIVACY_CONSENT_COOKIE = "synarava-consent";
export const PRIVACY_CONSENT_VERSION = 1;
export const PRIVACY_CONSENT_MAX_AGE = 60 * 60 * 24 * 180;
export const PRIVACY_CONSENT_CHANGED_EVENT = "synarava:consent-changed";
export const OPEN_PRIVACY_PREFERENCES_EVENT = "synarava:open-privacy-preferences";

export type PrivacyConsent = {
  version: typeof PRIVACY_CONSENT_VERSION;
  preferences: boolean;
  analytics: boolean;
  marketing: boolean;
  recordedAt: string;
};

export type PrivacyConsentChoices = Pick<
  PrivacyConsent,
  "preferences" | "analytics" | "marketing"
>;

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

export function parsePrivacyConsent(value: string | null | undefined): PrivacyConsent | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as Partial<PrivacyConsent>;
    if (
      parsed.version !== PRIVACY_CONSENT_VERSION
      || !isBoolean(parsed.preferences)
      || !isBoolean(parsed.analytics)
      || !isBoolean(parsed.marketing)
      || typeof parsed.recordedAt !== "string"
      || Number.isNaN(Date.parse(parsed.recordedAt))
    ) {
      return null;
    }

    return {
      version: PRIVACY_CONSENT_VERSION,
      preferences: parsed.preferences,
      analytics: parsed.analytics,
      marketing: parsed.marketing,
      recordedAt: parsed.recordedAt,
    };
  } catch {
    return null;
  }
}

export function createPrivacyConsent(
  choices: PrivacyConsentChoices,
  recordedAt = new Date().toISOString(),
): PrivacyConsent {
  return {
    version: PRIVACY_CONSENT_VERSION,
    ...choices,
    recordedAt,
  };
}

export function serializePrivacyConsent(consent: PrivacyConsent) {
  return encodeURIComponent(JSON.stringify(consent));
}

export function readClientPrivacyConsent(): PrivacyConsent | null {
  if (typeof document === "undefined") return null;
  const prefix = `${PRIVACY_CONSENT_COOKIE}=`;
  const value = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length);
  return parsePrivacyConsent(value);
}

export function hasAnalyticsConsent() {
  return readClientPrivacyConsent()?.analytics === true;
}

export function hasMarketingConsent() {
  return readClientPrivacyConsent()?.marketing === true;
}
