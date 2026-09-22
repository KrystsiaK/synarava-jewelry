import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ saveStorefrontCopyAction: vi.fn() }));

vi.mock("@/app/admin/actions/storefront-copy", () => ({
  saveStorefrontCopyAction: mocks.saveStorefrontCopyAction,
}));

import { StorefrontCopyEditor } from "@/components/admin/settings/storefront-copy-editor";

const EN_PT_LOCALES = [
  { code: "en", label: "English" },
  { code: "pt", label: "Português" },
];

beforeEach(() => vi.clearAllMocks());

describe("StorefrontCopyEditor", () => {
  it("switches to the Portuguese panel, hiding EN fields and showing independent PT values", async () => {
    const user = userEvent.setup();
    render(
      <StorefrontCopyEditor
        copy={{ en: { "nav.home": "Home" }, pt: { "nav.home": "Início" } }}
        defaults={{ en: {}, pt: {} }}
        locales={EN_PT_LOCALES}
      />,
    );

    expect(screen.getByLabelText("Home (EN)")).toBeVisible();
    expect(screen.getByLabelText("Home (PT)")).not.toBeVisible();

    await user.click(screen.getByRole("tab", { name: "Português" }));

    expect(screen.getByLabelText("Home (EN)")).not.toBeVisible();
    expect(screen.getByLabelText("Home (PT)")).toBeVisible();
    expect(screen.getByLabelText("Home (PT)")).toHaveValue("Início");
  });

  it("submits both en: and pt: prefixed keys in one save", async () => {
    mocks.saveStorefrontCopyAction.mockResolvedValue({ success: "Site copy saved." });
    const user = userEvent.setup();
    render(
      <StorefrontCopyEditor
        copy={{ en: {}, pt: {} }}
        defaults={{ en: {}, pt: {} }}
        locales={EN_PT_LOCALES}
      />,
    );

    await user.type(screen.getByLabelText("Home (EN)"), "Home");
    await user.click(screen.getByRole("tab", { name: "Português" }));
    await user.type(screen.getByLabelText("Home (PT)"), "Início");
    await user.click(screen.getByRole("button", { name: "Save site copy" }));

    expect(mocks.saveStorefrontCopyAction).toHaveBeenCalledTimes(1);
    const formData = mocks.saveStorefrontCopyAction.mock.calls[0][0] as FormData;
    expect(formData.get("en:nav.home")).toBe("Home");
    expect(formData.get("pt:nav.home")).toBe("Início");
  });

  it("renders and submits a third registered locale (Russian) the same way as EN/PT", async () => {
    const user = userEvent.setup();
    render(
      <StorefrontCopyEditor
        copy={{ en: {}, pt: {}, ru: { "nav.home": "Главная" } }}
        defaults={{ en: {}, pt: {} }}
        locales={[...EN_PT_LOCALES, { code: "ru", label: "Русский" }]}
      />,
    );

    await user.click(screen.getByRole("tab", { name: "Русский" }));
    expect(screen.getByLabelText("Home (RU)")).toBeVisible();
    expect(screen.getByLabelText("Home (RU)")).toHaveValue("Главная");

    await user.click(screen.getByRole("button", { name: "Save site copy" }));
    const formData = mocks.saveStorefrontCopyAction.mock.calls[0][0] as FormData;
    expect(formData.get("ru:nav.home")).toBe("Главная");
  });
});
