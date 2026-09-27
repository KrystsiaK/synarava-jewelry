import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPageBySlug: vi.fn(),
  getServerTranslations: vi.fn(),
}));

vi.mock("@/lib/content/catalog", () => ({
  getPageBySlug: mocks.getPageBySlug,
}));

vi.mock("@/lib/i18n/server", () => ({
  getServerTranslations: mocks.getServerTranslations,
}));

import PrivacyPage from "../page";

const locales = ["en", "pt", "ru"] as const;

describe("PrivacyPage body intro", () => {
  beforeEach(() => {
    mocks.getPageBySlug.mockReset();
    mocks.getServerTranslations.mockReset();
  });

  it.each(locales)("renders the admin Body for the active locale (%s)", async (locale) => {
    const intro = `<p>Privacy intro ${locale}</p>`;
    mocks.getServerTranslations.mockResolvedValue({
      locale,
      t: (key: string) => key,
    });
    mocks.getPageBySlug.mockResolvedValue({
      title: "Privacy Policy",
      excerpt: "Summary",
      content: {
        body: intro,
        legalLastUpdated: "1 June 2025",
        legalSections: [
          {
            id: "who",
            label: "Who",
            title: "Who we are",
            body: "<ul><li>One item</li></ul>",
          },
        ],
      },
    });

    render(await PrivacyPage());

    expect(mocks.getPageBySlug).toHaveBeenCalledWith("privacy", locale);
    expect(screen.getByText(`Privacy intro ${locale}`)).toBeInTheDocument();
    expect(screen.getByRole("list").closest(".legal-markdown.rich-text")).not.toBeNull();
  });

  it("omits the intro when the admin Body is empty", async () => {
    mocks.getServerTranslations.mockResolvedValue({
      locale: "en",
      t: (key: string) => key,
    });
    mocks.getPageBySlug.mockResolvedValue({
      title: "Privacy Policy",
      excerpt: "",
      content: {
        body: "   ",
        legalLastUpdated: "1 June 2025",
        legalSections: [],
      },
    });

    const { container } = render(await PrivacyPage());

    expect(container.querySelector("header .rich-text")).toBeNull();
    expect(screen.queryByText("legal.privacy.title")).toBeInTheDocument();
  });
});
