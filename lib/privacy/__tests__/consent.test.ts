import { describe, expect, it } from "vitest";

import {
  createPrivacyConsent,
  parsePrivacyConsent,
  PRIVACY_CONSENT_VERSION,
  serializePrivacyConsent,
} from "../consent";

describe("privacy consent", () => {
  it("round-trips a versioned consent record", () => {
    const consent = createPrivacyConsent(
      { preferences: true, analytics: false, marketing: true },
      "2026-09-05T10:00:00.000Z",
    );

    expect(parsePrivacyConsent(serializePrivacyConsent(consent))).toEqual(consent);
  });

  it("rejects malformed, incomplete, and obsolete records", () => {
    expect(parsePrivacyConsent("not-json")).toBeNull();
    expect(parsePrivacyConsent(encodeURIComponent(JSON.stringify({
      version: PRIVACY_CONSENT_VERSION - 1,
      preferences: false,
      analytics: false,
      marketing: false,
      recordedAt: "2026-09-05T10:00:00.000Z",
    })))).toBeNull();
    expect(parsePrivacyConsent(encodeURIComponent(JSON.stringify({
      version: PRIVACY_CONSENT_VERSION,
      preferences: false,
      analytics: false,
      recordedAt: "2026-09-05T10:00:00.000Z",
    })))).toBeNull();
  });
});
