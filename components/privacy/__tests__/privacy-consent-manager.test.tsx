import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PrivacyConsentManager } from "../privacy-consent-manager";
import {
  createPrivacyConsent,
  OPEN_PRIVACY_PREFERENCES_EVENT,
  PRIVACY_CONSENT_COOKIE,
  serializePrivacyConsent,
} from "@/lib/privacy/consent";

vi.mock("next/script", () => ({ default: () => null }));

describe("PrivacyConsentManager", () => {
  beforeEach(() => {
    document.cookie = `${PRIVACY_CONSENT_COOKIE}=; Path=/; Max-Age=0`;
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

  it("reopens granular settings after an earlier decision", async () => {
    const initialConsent = serializePrivacyConsent(createPrivacyConsent({
      preferences: false,
      analytics: false,
      marketing: false,
    }));
    render(<PrivacyConsentManager initialConsent={initialConsent} />);

    fireEvent(window, new Event(OPEN_PRIVACY_PREFERENCES_EVENT));

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "Cookie preferences" })).toBeInTheDocument();
    });
    expect(screen.getByRole("checkbox", { name: /Analytics/ })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Marketing/ })).not.toBeChecked();
  });
});
