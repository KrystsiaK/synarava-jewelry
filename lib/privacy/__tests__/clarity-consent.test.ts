import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  revokeClarityConsent,
  signalClarityConsentV2,
} from "../clarity-consent";

describe("Clarity Consent API v2", () => {
  beforeEach(() => {
    Reflect.deleteProperty(window, "clarity");
  });

  afterEach(() => {
    Reflect.deleteProperty(window, "clarity");
  });

  it("analytics=true marketing=false → consentv2 ad denied / analytics granted", () => {
    const clarity = vi.fn();
    window.clarity = clarity;

    signalClarityConsentV2({ analytics: true, marketing: false });

    expect(clarity).toHaveBeenCalledTimes(1);
    expect(clarity).toHaveBeenCalledWith("consentv2", {
      ad_Storage: "denied",
      analytics_Storage: "granted",
    });
  });

  it("marketing=true → ad_Storage granted", () => {
    const clarity = vi.fn();
    window.clarity = clarity;

    signalClarityConsentV2({ analytics: true, marketing: true });

    expect(clarity).toHaveBeenCalledWith("consentv2", {
      ad_Storage: "granted",
      analytics_Storage: "granted",
    });
  });

  it("revoke → clarity consent false", () => {
    const clarity = vi.fn();
    window.clarity = clarity;

    revokeClarityConsent();

    expect(clarity).toHaveBeenCalledTimes(1);
    expect(clarity).toHaveBeenCalledWith("consent", false);
  });

  it("no window.clarity → no throw", () => {
    expect(() =>
      signalClarityConsentV2({ analytics: true, marketing: false }),
    ).not.toThrow();
    expect(() => revokeClarityConsent()).not.toThrow();
  });
});
