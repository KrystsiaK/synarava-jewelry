import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ saveCommerceCopyAction: vi.fn() }));

vi.mock("@/app/admin/actions/commerce-copy", () => ({
  saveCommerceCopyAction: mocks.saveCommerceCopyAction,
}));

import { CommerceCopyEditor } from "@/components/admin/commerce/commerce-copy-editor";

const EN_PT_LOCALES = [
  { code: "en", label: "English" },
  { code: "pt", label: "Português" },
];

beforeEach(() => vi.clearAllMocks());

describe("CommerceCopyEditor", () => {
  it("keeps cart, checkout handoff, and login in one form and marks the copy local-only", () => {
    render(
      <CommerceCopyEditor
        copy={{ en: { "nav.cart": "Bag" }, pt: {} }}
        defaults={{ en: { "nav.cart": "Cart", "loginPage.submit": "Sign in or create account" }, pt: {} }}
        locales={EN_PT_LOCALES}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("SHOPIFY: LOCAL ONLY");
    expect(document.getElementById("commerce-cart")).toBeTruthy();
    expect(document.getElementById("commerce-checkout")).toBeTruthy();
    expect(document.getElementById("commerce-login")).toBeTruthy();
    expect(screen.getByLabelText("Cart (EN)")).toHaveValue("Bag");
    expect(screen.getByLabelText("Sign-in button (EN)")).toHaveValue("");
    expect(screen.getByLabelText("Sign-in button (EN)")).toHaveAttribute(
      "placeholder",
      "Sign in or create account",
    );
  });

  it("submits the active locale’s cart label without clearing the hidden one", async () => {
    mocks.saveCommerceCopyAction.mockResolvedValue({ success: "Cart & account saved." });
    const user = userEvent.setup();
    render(
      <CommerceCopyEditor
        copy={{ en: { "nav.cart": "Bag" }, pt: { "nav.cart": "Saco" } }}
        defaults={{ en: {}, pt: {} }}
        locales={EN_PT_LOCALES}
      />,
    );

    await user.clear(screen.getByLabelText("Cart (EN)"));
    await user.type(screen.getByLabelText("Cart (EN)"), "Basket");
    await user.click(screen.getByRole("button", { name: "Save cart & account" }));

    const formData = mocks.saveCommerceCopyAction.mock.calls[0][0] as FormData;
    expect(formData.get("en:nav.cart")).toBe("Basket");
    expect(formData.get("pt:nav.cart")).toBe("Saco");
    expect(formData.get("en:loginPage.submit")).toBe("");
  });
});
