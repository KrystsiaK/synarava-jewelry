import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PrivacyConsentManager } from "../privacy-consent-manager";
import { PRIVACY_CONSENT_COOKIE } from "@/lib/privacy/consent";

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
});
