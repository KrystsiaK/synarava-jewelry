import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ saveStorefrontCopyAction: vi.fn() }));

vi.mock("@/app/admin/actions/storefront-copy", () => ({
  saveStorefrontCopyAction: mocks.saveStorefrontCopyAction,
}));

vi.mock("@/app/admin/actions/storefront-href", () => ({
  searchStorefrontHrefsAction: vi.fn(async () => ({ segments: [] })),
}));

import { StorefrontCopyEditor } from "@/components/admin/settings/storefront-copy-editor";
import { DEFAULT_FOOTER_CONTACT_EMAIL } from "@/lib/content/footer-contact-fields";
import { defaultFooterLinks } from "@/lib/content/footer-links-fields";
import { DEFAULT_HEADER_NAV_ITEMS } from "@/lib/content/header-nav-fields";

const EN_PT_LOCALES = [
  { code: "en", label: "English" },
  { code: "pt", label: "Português" },
];

const defaultHeaderNav = { items: DEFAULT_HEADER_NAV_ITEMS, labels: {} };
const defaultFooter = defaultFooterLinks();

beforeEach(() => vi.clearAllMocks());

describe("StorefrontCopyEditor", () => {
  it("switches to the Portuguese panel, hiding EN fields and showing independent PT values", async () => {
    const user = userEvent.setup();
    render(
      <StorefrontCopyEditor
        copy={{ en: { "nav.cart": "Cart" }, pt: { "nav.cart": "Carrinho" } }}
        defaults={{ en: {}, pt: {} }}
        headerNav={defaultHeaderNav}
        footerLinks={defaultFooter}
        contactEmails={[DEFAULT_FOOTER_CONTACT_EMAIL]}
        locales={EN_PT_LOCALES}
      />,
    );

    expect(screen.getByLabelText("Cart (EN)")).toBeVisible();
    expect(screen.getByLabelText("Cart (PT)")).not.toBeVisible();

    await user.click(screen.getByRole("tab", { name: "Português" }));

    expect(screen.getByLabelText("Cart (EN)")).not.toBeVisible();
    expect(screen.getByLabelText("Cart (PT)")).toBeVisible();
    expect(screen.getByLabelText("Cart (PT)")).toHaveValue("Carrinho");
  });

  it("submits header nav, footer links, and emails in one save", async () => {
    mocks.saveStorefrontCopyAction.mockResolvedValue({ success: "Shared saved." });
    const user = userEvent.setup();
    render(
      <StorefrontCopyEditor
        copy={{ en: {}, pt: {} }}
        defaults={{ en: {}, pt: {} }}
        headerNav={defaultHeaderNav}
        footerLinks={defaultFooter}
        contactEmails={[DEFAULT_FOOTER_CONTACT_EMAIL]}
        locales={EN_PT_LOCALES}
      />,
    );

    await user.type(screen.getByLabelText("Cart (EN)"), "Bag");
    await user.click(screen.getByRole("tab", { name: "Português" }));
    await user.type(screen.getByLabelText("Cart (PT)"), "Saco");
    await user.click(screen.getByRole("button", { name: "Save Shared" }));

    expect(mocks.saveStorefrontCopyAction).toHaveBeenCalledTimes(1);
    const formData = mocks.saveStorefrontCopyAction.mock.calls[0][0] as FormData;
    expect(formData.get("en:nav.cart")).toBe("Bag");
    expect(formData.get("pt:nav.cart")).toBe("Saco");
    expect(JSON.parse(String(formData.get("footerContactEmails")))).toEqual([
      DEFAULT_FOOTER_CONTACT_EMAIL,
    ]);
    const headerNav = JSON.parse(String(formData.get("headerNav")));
    expect(headerNav.items).toEqual(DEFAULT_HEADER_NAV_ITEMS);
    const service = JSON.parse(String(formData.get("footerServiceLinks")));
    expect(service.items.length).toBeGreaterThan(0);
    expect(JSON.parse(String(formData.get("footerLegalLinks"))).items.length).toBeGreaterThan(0);
    expect(JSON.parse(String(formData.get("footerSocialLinks"))).items).toEqual([]);
  });

  it("renders and submits a third registered locale (Russian) the same way as EN/PT", async () => {
    const user = userEvent.setup();
    render(
      <StorefrontCopyEditor
        copy={{ en: {}, pt: {}, ru: { "nav.cart": "Корзина" } }}
        defaults={{ en: {}, pt: {} }}
        headerNav={defaultHeaderNav}
        footerLinks={defaultFooter}
        contactEmails={[DEFAULT_FOOTER_CONTACT_EMAIL]}
        locales={[...EN_PT_LOCALES, { code: "ru", label: "Русский" }]}
      />,
    );

    await user.click(screen.getByRole("tab", { name: "Русский" }));
    expect(screen.getByLabelText("Cart (RU)")).toBeVisible();
    expect(screen.getByLabelText("Cart (RU)")).toHaveValue("Корзина");

    await user.click(screen.getByRole("button", { name: "Save Shared" }));
    const formData = mocks.saveStorefrontCopyAction.mock.calls[0][0] as FormData;
    expect(formData.get("ru:nav.cart")).toBe("Корзина");
  });

  it("lets the operator add a main link row with name and path fields", async () => {
    const user = userEvent.setup();
    render(
      <StorefrontCopyEditor
        copy={{ en: {}, pt: {} }}
        defaults={{ en: {}, pt: {} }}
        headerNav={defaultHeaderNav}
        footerLinks={defaultFooter}
        contactEmails={[DEFAULT_FOOTER_CONTACT_EMAIL]}
        locales={EN_PT_LOCALES}
      />,
    );

    expect(screen.getByText("Header — main links")).toBeInTheDocument();
    const headerSection = document.getElementById("copy-header-main")!;
    expect(within(headerSection).getByRole("list", { name: "Main links" }).querySelectorAll("[data-component='AdminHrefField']")).toHaveLength(4);
    await user.click(within(headerSection).getByRole("button", { name: "Add link" }));
    expect(within(headerSection).getByRole("list", { name: "Main links" }).querySelectorAll("[data-component='AdminHrefField']")).toHaveLength(5);
  });

  it("exposes footer link editors and contact emails instead of label-only service/legal rows", () => {
    render(
      <StorefrontCopyEditor
        copy={{ en: {}, pt: {} }}
        defaults={{ en: {}, pt: {} }}
        headerNav={defaultHeaderNav}
        footerLinks={defaultFooter}
        contactEmails={["ops@synarava.com"]}
        locales={EN_PT_LOCALES}
      />,
    );

    expect(screen.getByText("Footer — service links")).toBeInTheDocument();
    expect(screen.getByText("Footer — legal links")).toBeInTheDocument();
    expect(screen.getByText("Footer — social links")).toBeInTheDocument();
    expect(screen.getByText("Footer — contact emails")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Email (primary)" })).toHaveValue("ops@synarava.com");
    expect(screen.getByText("Shared — contact CTA")).toBeInTheDocument();
    expect(screen.queryByLabelText("Care Guide (EN)")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Privacy Policy (EN)")).not.toBeInTheDocument();
    expect(screen.getAllByLabelText("Column heading (EN)").length).toBeGreaterThan(0);
  });
});
