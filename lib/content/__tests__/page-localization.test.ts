const mocks = vi.hoisted(() => ({
  findUniquePage: vi.fn(),
  getRequestLocale: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: { page: { findFirst: mocks.findUniquePage, findUnique: mocks.findUniquePage } },
}));
vi.mock("@/lib/i18n/server", () => ({ getRequestLocale: mocks.getRequestLocale }));

import { getPageBySlug } from "@/lib/content/catalog";

describe("getPageBySlug localization", () => {
  it("uses Portuguese department copy and falls back field-by-field for empty translations", async () => {
    mocks.getRequestLocale.mockResolvedValue("pt");
    mocks.findUniquePage.mockResolvedValue({
      slug: "home",
      title: "Home",
      excerpt: "English excerpt",
      status: "PUBLISHED",
      visibility: "PUBLIC",
      content: {
        departmentSectionEnabled: true,
        departmentSectionTitle: "Choose where to begin.",
        departmentSectionBody: "English section body.",
        departmentSectionCtaLabel: "Explore the shop",
        translations: {
          pt: {
            departmentSectionTitle: "Escolha por onde começar.",
            departmentSectionBody: "",
            departmentSectionCtaLabel: "Explorar a loja",
          },
        },
      },
    });

    await expect(getPageBySlug("home")).resolves.toMatchObject({
      content: {
        departmentSectionEnabled: true,
        departmentSectionTitle: "Escolha por onde começar.",
        departmentSectionBody: "English section body.",
        departmentSectionCtaLabel: "Explorar a loja",
      },
    });
  });

  it("uses an explicit locale without reading request headers", async () => {
    mocks.getRequestLocale.mockClear();
    mocks.findUniquePage.mockResolvedValue({
      slug: "shop",
      title: "Shop",
      excerpt: "English excerpt",
      status: "PUBLISHED",
      visibility: "PUBLIC",
      content: { translations: { pt: { title: "Loja", excerpt: "Resumo" } } },
    });

    await expect(getPageBySlug("shop", "pt")).resolves.toMatchObject({ title: "Loja", excerpt: "Resumo" });
    expect(mocks.getRequestLocale).not.toHaveBeenCalled();
  });

  it("prefers the normalized PageTranslation row over legacy content JSON", async () => {
    mocks.findUniquePage.mockResolvedValue({
      slug: "about",
      title: "About",
      excerpt: "English",
      status: "PUBLISHED",
      visibility: "PUBLIC",
      content: { body: "English body", translations: { pt: { title: "Legacy", body: "Legacy body" } } },
      translations: [{ locale: "PT", title: "Sobre", excerpt: "Resumo", content: { body: "Corpo normalizado" } }],
    });

    await expect(getPageBySlug("about", "pt")).resolves.toMatchObject({
      title: "Sobre",
      excerpt: "Resumo",
      content: { body: "Corpo normalizado" },
    });
  });
});
