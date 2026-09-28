import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import en from "@/messages/en.json";
import pt from "@/messages/pt.json";
import ru from "@/messages/ru.json";
import { flattenMessages } from "@/lib/i18n/utils";
import { TERMS_RU_EXCERPT_DEFAULT } from "@/lib/content/terms-defaults";

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

import TermsPage from "../page";

const dictionaries = {
  en: flattenMessages(en as Record<string, unknown>),
  pt: flattenMessages(pt as Record<string, unknown>),
  ru: flattenMessages(ru as Record<string, unknown>),
};

function translate(locale: keyof typeof dictionaries) {
  const messages = dictionaries[locale];
  const fallback = dictionaries.en;
  return (key: string) => messages[key] ?? fallback[key] ?? key;
}

describe("terms header copy", () => {
  beforeEach(() => {
    mocks.getPageBySlug.mockReset();
    mocks.getServerTranslations.mockReset();
  });

  it("shows the Russian eyebrow and excerpt when the saved fields are empty", async () => {
    mocks.getServerTranslations.mockResolvedValue({ locale: "ru", t: translate("ru") });
    mocks.getPageBySlug.mockResolvedValue({
      title: "Условия и положения",
      excerpt: "English excerpt",
      ownedEyebrow: "",
      ownedExcerpt: "",
      content: {
        legalIntro: "These Terms & Conditions apply to purchases made through Synarava Shop. Please read them before placing an order.",
        legalSections: [],
      },
    });

    render(await TermsPage());

    expect(screen.getByText("ЮРИДИЧЕСКАЯ ИНФОРМАЦИЯ")).toBeInTheDocument();
    expect(screen.getByText(TERMS_RU_EXCERPT_DEFAULT)).toBeInTheDocument();
    expect(screen.queryByText("Legal")).not.toBeInTheDocument();
  });

  it("shows the Portuguese eyebrow and keeps the existing excerpt", async () => {
    mocks.getServerTranslations.mockResolvedValue({ locale: "pt", t: translate("pt") });
    mocks.getPageBySlug.mockResolvedValue({
      title: "Termos e Condições",
      excerpt: "",
      ownedEyebrow: "",
      ownedExcerpt: "",
      content: {
        legalIntro: "Estes termos aplicam-se às compras na Synarava.",
        legalSections: [],
      },
    });

    render(await TermsPage());

    expect(screen.getByText("INFORMAÇÃO LEGAL")).toBeInTheDocument();
    expect(screen.getByText("Estes termos aplicam-se às compras na Synarava.")).toBeInTheDocument();
    expect(screen.queryByText("Legal")).not.toBeInTheDocument();
  });

  it("shows an admin eyebrow and excerpt instead of the locale default", async () => {
    mocks.getServerTranslations.mockResolvedValue({ locale: "ru", t: translate("ru") });
    mocks.getPageBySlug.mockResolvedValue({
      title: "Условия и положения",
      excerpt: "English excerpt",
      ownedEyebrow: "СВОЙ ЗАГОЛОВОК",
      ownedExcerpt: "Свой абзац из админки.",
      content: { legalIntro: "English intro", legalSections: [] },
    });

    render(await TermsPage());

    expect(screen.getByText("СВОЙ ЗАГОЛОВОК")).toBeInTheDocument();
    expect(screen.getByText("Свой абзац из админки.")).toBeInTheDocument();
    expect(screen.queryByText("ЮРИДИЧЕСКАЯ ИНФОРМАЦИЯ")).not.toBeInTheDocument();
    expect(screen.queryByText(TERMS_RU_EXCERPT_DEFAULT)).not.toBeInTheDocument();
  });
});
