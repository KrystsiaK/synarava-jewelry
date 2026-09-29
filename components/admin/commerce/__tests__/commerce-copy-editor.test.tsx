import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ saveCommerceCopyAction: vi.fn() }));

vi.mock("@/app/admin/actions/commerce-copy", () => ({
  saveCommerceCopyAction: mocks.saveCommerceCopyAction,
}));

/** TipTap × every locale × every long field dominates jsdom time — keep a11y labels. */
vi.mock("@/components/admin/shared/admin-rich-text-field", () => ({
  AdminRichTextField: ({
    label,
    name,
    defaultValue,
    placeholder,
  }: {
    label?: string;
    name?: string;
    defaultValue?: string | null;
    placeholder?: string;
  }) => (
    <label data-component="AdminRichTextField">
      {label ?? "Rich text"}
      <textarea name={name} defaultValue={defaultValue ?? ""} placeholder={placeholder} />
    </label>
  ),
}));

import { CommerceCopyEditor } from "@/components/admin/commerce/commerce-copy-editor";

const EN_PT_LOCALES = [
  { code: "en", label: "English" },
  { code: "pt", label: "Português" },
];

/** Scope label queries to one area — document-wide getByLabelText walks a large tree. */
function area(id: string) {
  const node = document.getElementById(`commerce-${id}`);
  if (!node) throw new Error(`Missing area #commerce-${id}`);
  return within(node);
}

function setLabeledValue(scope: ReturnType<typeof within>, label: string, value: string) {
  fireEvent.change(scope.getByLabelText(label), { target: { value } });
}

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
    expect(document.querySelector("[data-component='AdminPanel']")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save cart & account" })).toBeTruthy();
    expect(document.getElementById("commerce-cart")).toBeTruthy();
    expect(document.getElementById("commerce-checkout")).toBeTruthy();
    expect(document.getElementById("commerce-login")).toBeTruthy();
    expect(area("entry").getByLabelText("Cart (EN)")).toHaveValue("Bag");
    expect(area("login").getByLabelText("Sign-in button (EN)", { hidden: true })).toHaveValue("");
    expect(area("login").getByLabelText("Sign-in button (EN)", { hidden: true })).toHaveAttribute(
      "placeholder",
      "Sign in or create account",
    );
  });

  it("submits the active locale’s cart label without clearing the hidden one", async () => {
    mocks.saveCommerceCopyAction.mockResolvedValue({ success: "Cart & account saved." });
    const user = userEvent.setup({ delay: null });
    render(
      <CommerceCopyEditor
        copy={{ en: { "nav.cart": "Bag" }, pt: { "nav.cart": "Saco" } }}
        defaults={{ en: {}, pt: {} }}
        locales={EN_PT_LOCALES}
      />,
    );

    setLabeledValue(area("entry"), "Cart (EN)", "Basket");
    await user.click(screen.getByRole("button", { name: "Save cart & account" }));

    const formData = mocks.saveCommerceCopyAction.mock.calls[0][0] as FormData;
    expect(formData.get("en:nav.cart")).toBe("Basket");
    expect(formData.get("pt:nav.cart")).toBe("Saco");
    expect(formData.get("en:loginPage.submit")).toBe("");
  });
});
