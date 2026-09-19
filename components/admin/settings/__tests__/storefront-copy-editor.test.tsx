import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ saveStorefrontCopyAction: vi.fn() }));

vi.mock("@/app/admin/actions/storefront-copy", () => ({
  saveStorefrontCopyAction: mocks.saveStorefrontCopyAction,
}));

import { StorefrontCopyEditor } from "@/components/admin/settings/storefront-copy-editor";

beforeEach(() => vi.clearAllMocks());

describe("StorefrontCopyEditor", () => {
  it("switches to the Portuguese panel, hiding EN fields and showing independent PT values", async () => {
    const user = userEvent.setup();
    render(
      <StorefrontCopyEditor
        copy={{ en: { "nav.home": "Home" }, pt: { "nav.home": "Início" } }}
        defaults={{ en: {}, pt: {} }}
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
    mocks.saveStorefrontCopyAction.mockResolvedValue({ success: "Storefront copy saved." });
    const user = userEvent.setup();
    render(
      <StorefrontCopyEditor
        copy={{ en: {}, pt: {} }}
        defaults={{ en: {}, pt: {} }}
      />,
    );

    await user.type(screen.getByLabelText("Home (EN)"), "Home");
    await user.click(screen.getByRole("tab", { name: "Português" }));
    await user.type(screen.getByLabelText("Home (PT)"), "Início");
    await user.click(screen.getByRole("button", { name: "Save storefront copy" }));

    expect(mocks.saveStorefrontCopyAction).toHaveBeenCalledTimes(1);
    const formData = mocks.saveStorefrontCopyAction.mock.calls[0][0] as FormData;
    expect(formData.get("en:nav.home")).toBe("Home");
    expect(formData.get("pt:nav.home")).toBe("Início");
  });
});
