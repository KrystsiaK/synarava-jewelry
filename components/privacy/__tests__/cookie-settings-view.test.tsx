import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { CookieSettingsView } from "../cookie-settings-view";
import {
  createPrivacyConsent,
  PRIVACY_CONSENT_COOKIE,
  serializePrivacyConsent,
} from "@/lib/privacy/consent";

describe("CookieSettingsView", () => {
  beforeEach(() => {
    document.cookie = `${PRIVACY_CONSENT_COOKIE}=; Path=/; Max-Age=0`;
  });

  it("renders the shared preferences form and persists save", async () => {
    const user = userEvent.setup();
    const initial = serializePrivacyConsent(createPrivacyConsent({
      preferences: false,
      analytics: false,
      marketing: false,
    }));
    render(<CookieSettingsView initialConsent={initial} />);

    expect(screen.getByRole("heading", { name: "Cookie preferences" })).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: /Analytics/ }));
    await user.click(screen.getByRole("button", { name: "Save choices" }));

    expect(document.cookie).toContain(`${PRIVACY_CONSENT_COOKIE}=`);
    expect(screen.getByRole("status")).toHaveTextContent("Your choices were saved.");
    expect(screen.getByRole("link", { name: "Back to Privacy Policy" })).toHaveAttribute(
      "href",
      "/en/privacy",
    );
  });
});
