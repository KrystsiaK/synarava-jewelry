const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  getCurrentAdminSession: vi.fn(),
  findFirstPage: vi.fn(),
  findUniquePage: vi.fn(),
  upsertPage: vi.fn(),
  upsertPageTranslation: vi.fn(),
  createAuditLog: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/admin-session", () => ({
  requireAdminSession: mocks.requireAdminSession,
  getCurrentAdminSession: mocks.getCurrentAdminSession,
}));
vi.mock("@/lib/content/revalidate-storefront", () => ({
  revalidateStorefrontPath: vi.fn(),
  revalidateStorefrontTemplate: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  db: {
    page: {
      findFirst: mocks.findFirstPage,
      findUnique: mocks.findUniquePage,
      upsert: mocks.upsertPage,
    },
    pageTranslation: { upsert: mocks.upsertPageTranslation },
    mediaAsset: { create: vi.fn() },
    auditLog: { create: mocks.createAuditLog },
  },
}));
vi.mock("@/lib/media/local-upload", () => ({ savePageImageUpload: vi.fn() }));
vi.mock("@/lib/i18n/admin-translation-locales", () => ({
  getAdminTranslationLocales: vi.fn().mockResolvedValue([{ code: "pt", label: "Português" }]),
}));

import { savePageAction } from "@/app/admin/actions/pages";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdminSession.mockResolvedValue({ username: "admin" });
  mocks.getCurrentAdminSession.mockResolvedValue({ sessionId: "session-1", username: "admin" });
  mocks.findFirstPage.mockResolvedValue(null);
  mocks.findUniquePage.mockResolvedValue(null);
  mocks.upsertPage.mockResolvedValue({
    id: "home-page",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-02"),
    slug: "home",
    title: "Home",
    excerpt: null,
    content: {},
    status: "PUBLISHED",
    visibility: "PUBLIC",
    translations: [],
  });
  mocks.upsertPageTranslation.mockResolvedValue({ id: "pt-home" });
});

describe("savePageAction", () => {
  it("persists bilingual home section settings", async () => {
    const formData = new FormData();
    formData.set("slug", "home");
    formData.set("title", "Home");
    formData.set("workflowState", "PUBLISHED");
    formData.set("heroSectionEnabled", "1");
    formData.set("archiveSectionEnabled", "1");
    formData.set("manifestoSectionEnabled", "1");
    formData.set("finalCtaSectionEnabled", "1");
    formData.set("archiveSectionLabel", "Recorded");
    formData.set("editSectionEyebrow", "Shop the edit");
    formData.set("editSectionTitle", "The Edit");
    formData.set("editSectionBody", "Four pieces to begin.");
    formData.set("editSectionCtaLabel", "View piece");
    formData.set("editProductId1", "bird");
    formData.set("editProductId2", "moon");
    formData.set("editProductId3", "dog");
    formData.set("editProductId4", "pearl");
    formData.set("ptEditSectionEyebrow", "Descubra a seleção");
    formData.set("ptEditSectionTitle", "A Seleção");
    formData.set("ptEditSectionBody", "Quatro peças para começar.");
    formData.set("ptEditSectionCtaLabel", "Ver peça");
    formData.set("materialSectionTitle", "Lexicon");
    formData.set("materialSectionNoteLabel", "Material notes");
    formData.set("ptMaterialSectionNoteLabel", "Notas de materiais");
    formData.set("manifestoSectionAttribution", "The Synarava Manifesto");
    formData.set("finalCtaLabel", "Enter the shop");
    formData.set("finalCtaHref", "/shop");
    formData.set("finalFooterTitle", "Objects kept for a lifetime.");
    formData.set("finalContactEmail", "studio@example.com");

    await expect(savePageAction(formData)).resolves.toMatchObject({ success: "Page created." });
    expect(mocks.upsertPage).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({
        content: expect.objectContaining({
          heroSectionEnabled: true,
          archiveSectionEnabled: true,
          editSectionEnabled: false,
          materialSectionEnabled: false,
          manifestoSectionEnabled: true,
          finalCtaSectionEnabled: true,
          archiveSectionLabel: "Recorded",
          editSectionEyebrow: "Shop the edit",
          editSectionTitle: "The Edit",
          editSectionBody: "Four pieces to begin.",
          editSectionCtaLabel: "View piece",
          editProductIds: ["bird", "moon", "dog", "pearl"],
          materialSectionTitle: "Lexicon",
          materialSectionNoteLabel: "Material notes",
          manifestoSectionAttribution: "The Synarava Manifesto",
          finalCtaLabel: "Enter the shop",
          finalCtaHref: "/shop",
          finalFooterTitle: "Objects kept for a lifetime.",
          finalContactEmail: "studio@example.com",
          translations: {
            pt: expect.objectContaining({
              editSectionTitle: "A Seleção",
              editSectionCtaLabel: "Ver peça",
              materialSectionNoteLabel: "Notas de materiais",
            }),
          },
        }),
      }),
    }));
    expect(mocks.upsertPageTranslation).toHaveBeenCalledWith(expect.objectContaining({
      where: { pageId_locale: { pageId: "home-page", locale: "pt" } },
      create: expect.objectContaining({
        pageId: "home-page",
        locale: "pt",
        title: "Home",
        content: expect.objectContaining({
          editSectionTitle: "A Seleção",
          editSectionCtaLabel: "Ver peça",
          materialSectionNoteLabel: "Notas de materiais",
        }),
      }),
    }));
  });
});
