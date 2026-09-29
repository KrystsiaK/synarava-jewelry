import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ saveAccountPageAction: vi.fn() }));

vi.mock("@/app/admin/actions/account-page", () => ({
  saveAccountPageAction: mocks.saveAccountPageAction,
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

import { AccountPageEditor } from "@/components/admin/account/account-page-editor";

const LOCALES = [
  { code: "en", label: "English" },
  { code: "pt", label: "Português" },
];

/** Scope label queries to one area — document-wide getByLabelText walks a large tree. */
function area(id: string) {
  const node = document.getElementById(`account-${id}`);
  if (!node) throw new Error(`Missing area #account-${id}`);
  return within(node);
}

function setLabeledValue(scope: ReturnType<typeof within>, label: string, value: string) {
  fireEvent.change(scope.getByLabelText(label), { target: { value } });
}

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
    const frame = area("frame");
    expect(frame.getByLabelText("Sign out (EN)")).toHaveValue("Leave");
    expect(frame.getByLabelText("Sign out (EN)")).toHaveAttribute("placeholder", "Sign out");
    expect(area("overview").getByLabelText("Orders label (EN)", { hidden: true })).toHaveValue("");
    expect(frame.getByLabelText("Sign out (PT)", { hidden: true })).toHaveValue("Sair");
  });

  it("submits a hidden tab and the other locale", async () => {
    mocks.saveAccountPageAction.mockResolvedValue({ success: "Customer account saved." });
    const user = userEvent.setup({ delay: null });
    render(
      <AccountPageEditor
        copy={{ en: { "profile.overview.orders": "Orders" }, pt: { "profile.signOut": "Sair" } }}
        defaults={{ en: {}, pt: {} }}
        locales={LOCALES}
      />,
    );

    setLabeledValue(area("frame"), "Sign out (EN)", "Exit");
    const save = screen.getByRole("button", { name: "Save customer account" });
    expect(save.closest("[data-component='AdminIconButton']")).not.toBeNull();
    expect(document.querySelector(".adm-panel__header--sticky")?.contains(save)).toBe(true);
    await user.click(save);

    const formData = mocks.saveAccountPageAction.mock.calls[0][0] as FormData;
    expect(formData.get("en:profile.signOut")).toBe("Exit");
    expect(formData.get("pt:profile.signOut")).toBe("Sair");
    expect(formData.get("en:profile.overview.orders")).toBe("Orders");
    expect(formData.get("en:nav.cart")).toBeNull();
  });
});
