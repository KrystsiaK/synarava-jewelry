const mocks = vi.hoisted(() => ({
  findUniquePage: vi.fn(),
  findRedirect: vi.fn(),
  getRequestLocale: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    page: { findFirst: mocks.findUniquePage, findUnique: mocks.findUniquePage },
    localizedHandleRedirect: { findUnique: mocks.findRedirect },
  },
}));
vi.mock("@/lib/i18n/server", () => ({ getRequestLocale: mocks.getRequestLocale }));

import { getPageBySlug } from "@/lib/content/catalog";

describe("getPageBySlug localization", () => {
  beforeEach(() => mocks.findRedirect.mockResolvedValue(null));
  it("uses Portuguese edit-section copy and falls back field-by-field for empty translations", async () => {
    mocks.getRequestLocale.mockResolvedValue("pt");
    mocks.findUniquePage.mockResolvedValue({
      slug: "home",
      title: "Home",
      excerpt: "English excerpt",
      status: "PUBLISHED",
      visibility: "PUBLIC",
      content: {
        editSectionTitle: "The Edit",
        editSectionBody: "English section body.",
        editSectionCtaLabel: "View piece",
        translations: {
          pt: {
            editSectionTitle: "A Seleção",
            editSectionBody: "",
            editSectionCtaLabel: "Ver peça",
          },
        },
      },
    });

    await expect(getPageBySlug("home")).resolves.toMatchObject({
      content: {
        editSectionTitle: "A Seleção",
        editSectionBody: "English section body.",
        editSectionCtaLabel: "Ver peça",
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
      translations: [{ locale: "pt", title: "Sobre", excerpt: "Resumo", content: { body: "Corpo normalizado" } }],
    });

    await expect(getPageBySlug("about", "pt")).resolves.toMatchObject({
      title: "Sobre",
      excerpt: "Resumo",
      content: { body: "Corpo normalizado" },
    });
  });

  it("resolves the active Portuguese handle and follows a persisted previous handle", async () => {
    const row = {
      id: "page-1", slug: "journal", title: "Journal", excerpt: null,
      status: "PUBLISHED", visibility: "PUBLIC", content: {},
      translations: [{ locale: "pt", title: "Diário", localizedHandle: "caderno", content: {} }],
    };
    mocks.findUniquePage.mockResolvedValueOnce(null).mockResolvedValueOnce(row);
    mocks.findRedirect.mockResolvedValue({ entityId: "page-1" });

    await expect(getPageBySlug("diario", "pt")).resolves.toMatchObject({
      slug: "caderno",
      sourceSlug: "journal",
      title: "Diário",
    });
  });
});
