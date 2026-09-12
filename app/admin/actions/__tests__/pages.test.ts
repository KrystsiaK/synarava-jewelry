const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  getCurrentAdminSession: vi.fn(),
  findFirstPage: vi.fn(),
  findUniquePage: vi.fn(),
  upsertPage: vi.fn(),
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
    mediaAsset: { create: vi.fn() },
    auditLog: { create: mocks.createAuditLog },
  },
}));
vi.mock("@/lib/media/local-upload", () => ({ savePageImageUpload: vi.fn() }));

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
  });
});

describe("savePageAction", () => {
  it("persists bilingual home department pathway settings", async () => {
    const formData = new FormData();
    formData.set("slug", "home");
    formData.set("title", "Home");
    formData.set("workflowState", "PUBLISHED");
    formData.set("departmentSectionEnabled", "1");
    formData.set("departmentSectionTitle", "Choose where to begin.");
    formData.set("departmentSectionBody", "A considered way into the collection.");
    formData.set("departmentSectionImageCaption", "One point of view.");
    formData.set("departmentSectionCtaLabel", "Explore the shop");
    formData.set("ptDepartmentSectionTitle", "Escolha por onde começar.");
    formData.set("ptDepartmentSectionBody", "Uma entrada cuidada na coleção.");

    await expect(savePageAction(formData)).resolves.toMatchObject({ success: "Page created." });
    expect(mocks.upsertPage).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({
        content: expect.objectContaining({
          departmentSectionEnabled: true,
          departmentSectionTitle: "Choose where to begin.",
          departmentSectionBody: "A considered way into the collection.",
          departmentSectionImageCaption: "One point of view.",
          departmentSectionCtaLabel: "Explore the shop",
          translations: {
            pt: expect.objectContaining({
              departmentSectionTitle: "Escolha por onde começar.",
              departmentSectionBody: "Uma entrada cuidada na coleção.",
            }),
          },
        }),
      }),
    }));
  });
});
