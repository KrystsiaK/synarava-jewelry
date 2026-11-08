import type { PrivacyConsentChoices } from "@/lib/privacy/consent";

type ClarityConsentStorage = "granted" | "denied";

type ClarityConsentV2Payload = {
  ad_Storage: ClarityConsentStorage;
  analytics_Storage: ClarityConsentStorage;
};

type ClarityFn = {
  (command: "consentv2", payload: ClarityConsentV2Payload): void;
  (command: "consent", value: boolean): void;
  (...args: unknown[]): void;
};

declare global {
  interface Window {
    clarity?: ClarityFn;
  }
}

function clarityFn(): ClarityFn | undefined {
  if (typeof window === "undefined") return undefined;
  const fn = window.clarity;
  return typeof fn === "function" ? fn : undefined;
}

/**
 * Mirror banner choices into Clarity Consent API v2.
 * @see https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-consent-api-v2
 */
export function signalClarityConsentV2(
  choices: Pick<PrivacyConsentChoices, "analytics" | "marketing">,
): void {
  const clarity = clarityFn();
  if (!clarity) return;
  clarity("consentv2", {
    ad_Storage: choices.marketing ? "granted" : "denied",
    analytics_Storage: choices.analytics ? "granted" : "denied",
  });
}

/** Clear Clarity cookies after analytics consent is withdrawn. */
export function revokeClarityConsent(): void {
  const clarity = clarityFn();
  if (!clarity) return;
  clarity("consent", false);
}
