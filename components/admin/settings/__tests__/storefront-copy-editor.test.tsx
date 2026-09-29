import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ saveStorefrontCopyAction: vi.fn() }));

vi.mock("@/app/admin/actions/storefront-copy", () => ({
  saveStorefrontCopyAction: mocks.saveStorefrontCopyAction,
}));

vi.mock("@/app/admin/actions/storefront-href", () => ({
  searchStorefrontHrefsAction: vi.fn(async () => ({ segments: [] })),
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

/** Full Shared editor DOM is heavy in jsdom — skip per-keystroke delay. */
function setupUser() {
  return userEvent.setup({ delay: null });
}

/** Scope label queries to one area — document-wide getByLabelText walks ~2k nodes. */
function area(id: "shared-header" | "shared-footer" | "shared-cookies" | "shared-contact" | "shared-reviews") {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing area #${id}`);
  return within(node);
}

function sharedAreaTab(name: RegExp | string) {
  const list = screen.getByRole("tablist", { name: "Shared areas" });
  return within(list).getByRole("tab", { name });
}

function localeTab(name: string) {
  const list = document.querySelector(".adm-locale-workspace-header") ?? document.body;
  return within(list as HTMLElement).getByRole("tab", { name });
}

function setLabeledValue(scope: ReturnType<typeof within>, label: string, value: string) {
  fireEvent.change(scope.getByLabelText(label), { target: { value } });
}

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(null, "", "/admin/settings");
});

describe("StorefrontCopyEditor", () => {
  it("switches to the Portuguese panel, hiding EN fields and showing independent PT values", async () => {
    const user = setupUser();
    render(
      <StorefrontCopyEditor
        copy={{ en: { "footer.tagline": "Tag" }, pt: { "footer.tagline": "Lema" } }}
        defaults={{ en: {}, pt: {} }}
        headerNav={defaultHeaderNav}
        footerLinks={defaultFooter}
        contactEmails={[DEFAULT_FOOTER_CONTACT_EMAIL]}
        locales={EN_PT_LOCALES}
      />,
    );

    await user.click(sharedAreaTab(/^Footer/));
    const footer = area("shared-footer");
    expect(footer.getByLabelText("Tagline (under the logo) (EN)")).toBeVisible();
    expect(footer.getByLabelText("Tagline (under the logo) (PT)")).not.toBeVisible();

    await user.click(localeTab("Português"));

    expect(footer.getByLabelText("Tagline (under the logo) (EN)")).not.toBeVisible();
    expect(footer.getByLabelText("Tagline (under the logo) (PT)")).toBeVisible();
    expect(footer.getByLabelText("Tagline (under the logo) (PT)")).toHaveValue("Lema");
  }, 30_000);

  it("submits header nav, footer links, and emails in one save", async () => {
    mocks.saveStorefrontCopyAction.mockResolvedValue({ success: "Shared saved." });
    const user = setupUser();
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

    await user.click(sharedAreaTab(/^Footer/));
    const footer = area("shared-footer");
    setLabeledValue(footer, "Tagline (under the logo) (EN)", "Bag");
    await user.click(localeTab("Português"));
    setLabeledValue(footer, "Tagline (under the logo) (PT)", "Saco");
    await user.click(screen.getByRole("button", { name: "Save Shared" }));

    expect(mocks.saveStorefrontCopyAction).toHaveBeenCalledTimes(1);
    const formData = mocks.saveStorefrontCopyAction.mock.calls[0][0] as FormData;
    expect(formData.get("en:footer.tagline")).toBe("Bag");
    expect(formData.get("pt:footer.tagline")).toBe("Saco");
    expect(JSON.parse(String(formData.get("footerContactEmails")))).toEqual([
      DEFAULT_FOOTER_CONTACT_EMAIL,
    ]);
    const headerNav = JSON.parse(String(formData.get("headerNav")));
    expect(headerNav.items).toEqual(DEFAULT_HEADER_NAV_ITEMS);
    const service = JSON.parse(String(formData.get("footerServiceLinks")));
    expect(service.items.length).toBeGreaterThan(0);
    expect(JSON.parse(String(formData.get("footerLegalLinks"))).items.length).toBeGreaterThan(0);
    expect(JSON.parse(String(formData.get("footerSocialLinks"))).items).toEqual([]);
  }, 30_000);

  it("renders and submits a third registered locale (Russian) the same way as EN/PT", async () => {
    const user = setupUser();
    render(
      <StorefrontCopyEditor
        copy={{ en: {}, pt: {}, ru: { "footer.tagline": "Слоган" } }}
        defaults={{ en: {}, pt: {} }}
        headerNav={defaultHeaderNav}
        footerLinks={defaultFooter}
        contactEmails={[DEFAULT_FOOTER_CONTACT_EMAIL]}
        locales={[...EN_PT_LOCALES, { code: "ru", label: "Русский" }]}
      />,
    );

    await user.click(sharedAreaTab(/^Footer/));
    await user.click(localeTab("Русский"));
    const footer = area("shared-footer");
    expect(footer.getByLabelText("Tagline (under the logo) (RU)")).toBeVisible();
    expect(footer.getByLabelText("Tagline (under the logo) (RU)")).toHaveValue("Слоган");

    await user.click(screen.getByRole("button", { name: "Save Shared" }));
    const formData = mocks.saveStorefrontCopyAction.mock.calls[0][0] as FormData;
    expect(formData.get("ru:footer.tagline")).toBe("Слоган");
  }, 30_000);

  it("lets the operator add a main link row with name and path fields", async () => {
    const user = setupUser();
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
  }, 30_000);

  it("exposes header, footer, cookies, and contact as separate areas", async () => {
    const user = setupUser();
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

    expect(screen.getByText("Header — main links")).toBeVisible();
    expect(screen.queryByText("Legal line")).not.toBeVisible();
    expect(document.querySelector("[data-component='AdminPanel']")).toBeTruthy();
    expect(document.querySelector(".adm-section-tabs")).toHaveAttribute("data-embedded", "true");
    expect(document.querySelector(".adm-locale-workspace-header--embedded")).toBeTruthy();
    expect(document.querySelector(".adm-section-tabs__list--standalone")).toBeNull();

    await user.click(sharedAreaTab(/^Footer/));
    const footer = area("shared-footer");
    expect(footer.getByText("Service column")).toBeVisible();
    expect(footer.getByText("Legal line")).toBeVisible();
    const legal = JSON.parse(
      (document.querySelector('input[name="footerLegalLinks"]') as HTMLInputElement).value,
    ) as { items: Array<{ id: string; href: string }> };
    expect(legal.items.map((item) => item.id)).toEqual([
      "terms",
      "privacy",
      "cookies",
      "livro",
      "dispute",
    ]);
    expect(legal.items.map((item) => item.href)).not.toContain("/legal-notice");
    expect(footer.getByText("Social column")).toBeVisible();
    expect(footer.getByText("Footer — contact emails")).toBeVisible();
    expect(footer.getByRole("textbox", { name: "Email (primary)" })).toHaveValue("ops@synarava.com");
    expect(footer.getAllByLabelText("Column heading (EN)").length).toBeGreaterThan(0);

    await user.click(sharedAreaTab(/^Cookies/));
    const cookies = area("shared-cookies");
    expect(cookies.getByText("Cookies — banner & preferences")).toBeVisible();
    expect(cookies.getByText("Cookies — settings page")).toBeVisible();
    expect(cookies.getByLabelText("Banner title (EN)")).toBeVisible();
    expect(cookies.getByLabelText("SEO title (EN)")).toBeVisible();

    await user.click(sharedAreaTab(/^Contact/));
    const contact = area("shared-contact");
    expect(contact.getByText("Shared — contact CTA")).toBeVisible();
    expect(screen.queryByLabelText("Care Guide (EN)")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Privacy Policy (EN)")).not.toBeInTheDocument();
  }, 30_000);

  it("keeps the leave-a-review form on its own Shared tab", async () => {
    const user = setupUser();
    render(
      <StorefrontCopyEditor
        copy={{ en: {}, pt: {} }}
        defaults={{ en: { "reviews.shareTitle": "Share your experience" }, pt: {} }}
        headerNav={defaultHeaderNav}
        footerLinks={defaultFooter}
        contactEmails={["ops@synarava.com"]}
        locales={EN_PT_LOCALES}
      />,
    );

    await user.click(sharedAreaTab(/^Reviews/));
    const reviews = area("shared-reviews");
    expect(reviews.getByText("Reviews — leave a review")).toBeVisible();
    expect(reviews.getByLabelText("Heading (EN)")).toHaveAttribute("placeholder", "Share your experience");
    expect(screen.queryByText("Header — main links")).not.toBeVisible();
  }, 30_000);
});
