const mocks = vi.hoisted(() => ({
  findUniquePage: vi.fn(),
  getRequestLocale: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: { page: { findUnique: mocks.findUniquePage } },
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
});
