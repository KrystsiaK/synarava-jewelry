import {
  createPrivacyConsent,
  PRIVACY_CONSENT_CHANGED_EVENT,
  PRIVACY_CONSENT_COOKIE,
  PRIVACY_CONSENT_MAX_AGE,
  serializePrivacyConsent,
  type PrivacyConsent,
  type PrivacyConsentChoices,
} from "@/lib/privacy/consent";

export const DEFAULT_PRIVACY_CHOICES: PrivacyConsentChoices = {
  preferences: false,
  analytics: false,
  marketing: false,
};

const OPTIONAL_COOKIE_PREFIXES = ["_ga", "_gid", "_gat", "_fbp", "_fbc"];

export function writeConsentCookie(consent: PrivacyConsent) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${PRIVACY_CONSENT_COOKIE}=${serializePrivacyConsent(consent)}; Path=/; Max-Age=${PRIVACY_CONSENT_MAX_AGE}; SameSite=Lax${secure}`;
}

export function clearKnownOptionalCookies() {
  for (const cookie of document.cookie.split(";")) {
    const name = cookie.split("=")[0]?.trim();
    if (!name || !OPTIONAL_COOKIE_PREFIXES.some((prefix) => name.startsWith(prefix))) continue;
    document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
  }
}

/** Persist a consent decision. Reloads when optional tracking is withdrawn. */
export function persistPrivacyConsent(
  choices: PrivacyConsentChoices,
  previous: PrivacyConsent | null,
): PrivacyConsent {
  const next = createPrivacyConsent(choices);
  const isWithdrawal = Boolean(
    previous
    && ((previous.analytics && !next.analytics) || (previous.marketing && !next.marketing)),
  );
  writeConsentCookie(next);
  if (isWithdrawal) clearKnownOptionalCookies();
  window.dispatchEvent(new CustomEvent(PRIVACY_CONSENT_CHANGED_EVENT, { detail: next }));
  if (isWithdrawal) window.location.reload();
  return next;
}
