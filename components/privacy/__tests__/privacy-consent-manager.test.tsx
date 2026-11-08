import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PrivacyConsentManager } from "../privacy-consent-manager";
import {
  createPrivacyConsent,
  PRIVACY_CONSENT_CHANGED_EVENT,
  PRIVACY_CONSENT_COOKIE,
  serializePrivacyConsent,
  type PrivacyConsent,
} from "@/lib/privacy/consent";

vi.mock("next/script", () => ({
  default: ({
    id,
    onReady,
  }: {
    id?: string;
    onReady?: () => void;
  }) => {
    if (id === "consent-aware-clarity" && onReady) {
      queueMicrotask(onReady);
    }
    return null;
  },
}));

describe("PrivacyConsentManager", () => {
  beforeEach(() => {
    document.cookie = `${PRIVACY_CONSENT_COOKIE}=; Path=/; Max-Age=0`;
    Reflect.deleteProperty(window, "clarity");
  });

  afterEach(() => {
    Reflect.deleteProperty(window, "clarity");
  });

  it("shows equally available consent choices and persists rejection", async () => {
    const user = userEvent.setup();
    render(<PrivacyConsentManager />);

    expect(screen.getByRole("button", { name: "Accept all" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reject optional" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Customize" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reject optional" }));

    expect(document.cookie).toContain(`${PRIVACY_CONSENT_COOKIE}=`);
    expect(screen.queryByRole("button", { name: "Accept all" })).not.toBeInTheDocument();
  });

  it("opens the shared preferences form from Customize on first visit", async () => {
    const user = userEvent.setup();
    render(<PrivacyConsentManager />);

    await user.click(screen.getByRole("button", { name: "Customize" }));

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "Cookie preferences" })).toBeInTheDocument();
    });
    expect(screen.getByRole("checkbox", { name: /Analytics/ })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Marketing/ })).not.toBeChecked();
  });

  it("signals Clarity consentv2 from existing consent (analytics granted, marketing denied)", async () => {
    const clarity = vi.fn();
    window.clarity = clarity;
    const consent = createPrivacyConsent({
      preferences: true,
      analytics: true,
      marketing: false,
    });

    render(
      <PrivacyConsentManager
        initialConsent={serializePrivacyConsent(consent)}
        claritySiteId="clarity-test"
      />,
    );

    await waitFor(() => {
      expect(clarity).toHaveBeenCalledWith("consentv2", {
        ad_Storage: "denied",
        analytics_Storage: "granted",
      });
    });
  });

  it("grants Clarity ad_Storage when marketing consent is true", async () => {
    const clarity = vi.fn();
    window.clarity = clarity;
    const consent = createPrivacyConsent({
      preferences: true,
      analytics: true,
      marketing: true,
    });

    render(
      <PrivacyConsentManager
        initialConsent={serializePrivacyConsent(consent)}
        claritySiteId="clarity-test"
      />,
    );

    await waitFor(() => {
      expect(clarity).toHaveBeenCalledWith("consentv2", {
        ad_Storage: "granted",
        analytics_Storage: "granted",
      });
    });
  });

  it("revokes Clarity cookies when analytics consent is withdrawn", async () => {
    const clarity = vi.fn();
    window.clarity = clarity;
    const granted = createPrivacyConsent({
      preferences: true,
      analytics: true,
      marketing: false,
    });

    render(
      <PrivacyConsentManager
        initialConsent={serializePrivacyConsent(granted)}
        claritySiteId="clarity-test"
      />,
    );

    await waitFor(() => {
      expect(clarity).toHaveBeenCalledWith("consentv2", expect.any(Object));
    });
    clarity.mockClear();

    const revoked: PrivacyConsent = {
      ...granted,
      analytics: false,
      marketing: false,
      recordedAt: new Date().toISOString(),
    };
    await act(async () => {
      window.dispatchEvent(
        new CustomEvent(PRIVACY_CONSENT_CHANGED_EVENT, { detail: revoked }),
      );
    });

    await waitFor(() => {
      expect(clarity).toHaveBeenCalledWith("consent", false);
    });
  });

  it("does not throw when Clarity is not on window", async () => {
    const consent = createPrivacyConsent({
      preferences: true,
      analytics: true,
      marketing: false,
    });

    expect(() =>
      render(
        <PrivacyConsentManager
          initialConsent={serializePrivacyConsent(consent)}
          claritySiteId="clarity-test"
        />,
      ),
    ).not.toThrow();

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Accept all" })).not.toBeInTheDocument();
    });
  });
});
