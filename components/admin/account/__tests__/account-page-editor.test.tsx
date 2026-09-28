import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ saveAccountPageAction: vi.fn() }));

vi.mock("@/app/admin/actions/account-page", () => ({
  saveAccountPageAction: mocks.saveAccountPageAction,
}));

import { AccountPageEditor } from "@/components/admin/account/account-page-editor";

const LOCALES = [
  { code: "en", label: "English" },
  { code: "pt", label: "Português" },
];

beforeEach(() => vi.clearAllMocks());

describe("AccountPageEditor", () => {
  it("opens on the frame and keeps the other tabs in the form", () => {
    render(
      <AccountPageEditor
        copy={{ en: { "profile.signOut": "Leave" }, pt: { "profile.signOut": "Sair" } }}
        defaults={{ en: { "profile.signOut": "Sign out", "profile.overview.orders": "Orders" }, pt: {} }}
        locales={LOCALES}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("SHOPIFY: LOCAL ONLY");
    expect(screen.getByLabelText("Sign out (EN)")).toHaveValue("Leave");
    expect(screen.getByLabelText("Sign out (EN)")).toHaveAttribute("placeholder", "Sign out");
    expect(screen.getByLabelText("Orders label (EN)", { hidden: true })).toHaveValue("");
    expect(screen.getByLabelText("Sign out (PT)", { hidden: true })).toHaveValue("Sair");
  });

  it("submits a hidden tab and the other locale", async () => {
    mocks.saveAccountPageAction.mockResolvedValue({ success: "Customer account saved." });
    const user = userEvent.setup();
    render(
      <AccountPageEditor
        copy={{ en: { "profile.overview.orders": "Orders" }, pt: { "profile.signOut": "Sair" } }}
        defaults={{ en: {}, pt: {} }}
        locales={LOCALES}
      />,
    );

    await user.clear(screen.getByLabelText("Sign out (EN)"));
    await user.type(screen.getByLabelText("Sign out (EN)"), "Exit");
    await user.click(screen.getByRole("button", { name: "Save customer account" }));

    const formData = mocks.saveAccountPageAction.mock.calls[0][0] as FormData;
    expect(formData.get("en:profile.signOut")).toBe("Exit");
    expect(formData.get("pt:profile.signOut")).toBe("Sair");
    expect(formData.get("en:profile.overview.orders")).toBe("Orders");
    expect(formData.get("en:nav.cart")).toBeNull();
  });
});
