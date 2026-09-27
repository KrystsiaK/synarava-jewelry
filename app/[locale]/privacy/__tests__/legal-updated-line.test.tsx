import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import en from "@/messages/en.json";
import ru from "@/messages/ru.json";
import { flattenMessages } from "@/lib/i18n/utils";

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

import OfferPage from "../../offer/page";
import LegalNoticePage from "../../legal-notice/page";
import PrivacyPage from "../page";
import TermsPage from "../../terms-and-conditions/page";

const enFlat = flattenMessages(en as Record<string, unknown>);
const ruFlat = flattenMessages(ru as Record<string, unknown>);

function russianT(key: string) {
  return ruFlat[key] ?? enFlat[key] ?? key;
}

describe("legal pages last-updated line", () => {
  beforeEach(() => {
    mocks.getPageBySlug.mockReset();
    mocks.getServerTranslations.mockReset();
    mocks.getServerTranslations.mockResolvedValue({ locale: "ru", t: russianT });
  });

  it.each([
    ["privacy", PrivacyPage],
    ["offer", OfferPage],
    ["terms-and-conditions", TermsPage],
    ["legal-notice", LegalNoticePage],
  ] as const)("uses the Russian admin label and a dictionary date on %s", async (slug, Page) => {
    mocks.getPageBySlug.mockResolvedValue({
      title: "Title",
      excerpt: "",
      content: {
        legalLastUpdated: "5 September 2026",
        legalLastUpdatedLabel: "Обновлено",
        legalSections: [],
      },
    });

    render(await Page());

    expect(mocks.getPageBySlug).toHaveBeenCalledWith(slug, "ru");
    expect(screen.getByText("Обновлено: 5 сентября 2026")).toBeInTheDocument();
    expect(screen.queryByText(/Last updated/)).not.toBeInTheDocument();
  });

  it("falls back to the Russian dictionary when the label field is empty", async () => {
    mocks.getPageBySlug.mockResolvedValue({
      title: "Privacy",
      excerpt: "",
      content: {
        legalLastUpdated: "5 September 2026",
        legalLastUpdatedLabel: "",
        legalSections: [],
      },
    });

    render(await PrivacyPage());

    expect(screen.getByText("Последнее обновление: 5 сентября 2026")).toBeInTheDocument();
  });
});
