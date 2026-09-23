import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ saveSiteSeoAction: vi.fn() }));

vi.mock("@/app/admin/actions/site-seo", () => ({
  saveSiteSeoAction: mocks.saveSiteSeoAction,
}));

import { SiteSeoEditor } from "@/components/admin/meta/site-seo-editor";

beforeEach(() => vi.clearAllMocks());

describe("SiteSeoEditor", () => {
  it("submits SEO fields and hub links to Pages / Catalog / Localization", async () => {
    mocks.saveSiteSeoAction.mockResolvedValue({ success: "Site SEO saved." });
    const user = userEvent.setup();
    render(<SiteSeoEditor overrides={{ defaultTitle: "Custom" }} />);

    expect(screen.getByRole("link", { name: /^Pages\b/i })).toHaveAttribute("href", "/admin/pages");
    expect(screen.getByRole("link", { name: /^Catalog\b/i })).toHaveAttribute("href", "/admin/products");
    expect(screen.getByRole("link", { name: /^Localization\b/i })).toHaveAttribute("href", "/admin/translations");

    const defaultTitle = document.querySelector('input[name="defaultTitle"]') as HTMLInputElement;
    expect(defaultTitle).toBeTruthy();
    await user.clear(defaultTitle);
    await user.type(defaultTitle, "New title");
    await user.click(screen.getByRole("button", { name: "Save site SEO" }));

    expect(mocks.saveSiteSeoAction).toHaveBeenCalledTimes(1);
    const formData = mocks.saveSiteSeoAction.mock.calls[0][0] as FormData;
    expect(formData.get("defaultTitle")).toBe("New title");
  });
});
