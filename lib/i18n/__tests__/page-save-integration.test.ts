import { beforeEach, describe, expect, it, vi } from "vitest";

// Real DB, real Prisma writes against the local dev Postgres — only auth,
// the registry locale list, and outbound side effects (revalidate, image
// upload) are mocked. Mirrors the Collection/Product save integration tests.
vi.mock("@/lib/auth/admin-session", () => ({
  requireAdminSession: vi.fn().mockResolvedValue({ username: "test-admin" }),
  getCurrentAdminSession: vi.fn().mockResolvedValue({ username: "test-admin" }),
}));
vi.mock("@/lib/i18n/admin-translation-locales", () => ({
  getAdminTranslationLocales: vi.fn().mockResolvedValue([
    { code: "pt", label: "Português" },
    { code: "ru", label: "Русский" },
  ]),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/content/revalidate-storefront", () => ({
  revalidateStorefrontPath: vi.fn(),
  revalidateStorefrontTemplate: vi.fn(),
}));
vi.mock("@/lib/media/local-upload", () => ({ savePageImageUpload: vi.fn() }));

import { db } from "@/lib/db";
import { savePageAction } from "@/app/admin/actions/pages";
import { adminLocaleFieldName } from "@/lib/i18n/admin-locale-fields";

function buildFormData(overrides: Record<string, string> = {}) {
  const fd = new FormData();
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const defaults: Record<string, string> = {
    pageId: "",
    slug: `u4-test-page-${unique}`,
    title: "U4 Integration Test Page",
    excerpt: "EN excerpt.",
    body: "EN body.",
    workflowState: "DRAFT",
    [adminLocaleFieldName("pt", "title")]: "Página de Teste U4",
    [adminLocaleFieldName("pt", "body")]: "Corpo PT.",
    [adminLocaleFieldName("ru", "title")]: "Тестовая страница U4",
    [adminLocaleFieldName("ru", "body")]: "Тело RU.",
  };
  for (const [key, value] of Object.entries({ ...defaults, ...overrides })) fd.set(key, value);
  return fd;
}

describe("savePageAction — N-locale translation save (real DB)", () => {
  let createdId: string | null = null;

  beforeEach(() => {
    createdId = null;
  });

  it("creates EN/PT/RU PageTranslation rows in one save, with correct registry locale codes", async () => {
    const result = await savePageAction(buildFormData());

    expect(result.error).toBeUndefined();
    expect(result.page).toBeTruthy();
    createdId = result.page!.id;

    const rows = await db.pageTranslation.findMany({
      where: { pageId: createdId! },
      orderBy: { locale: "asc" },
    });
    expect(rows.map((r) => r.locale)).toEqual(["en", "pt", "ru"]);

    const en = rows.find((r) => r.locale === "en")!;
    const pt = rows.find((r) => r.locale === "pt")!;
    const ru = rows.find((r) => r.locale === "ru")!;

    expect(en.title).toBe("U4 Integration Test Page");
    expect(pt.title).toBe("Página de Teste U4");
    expect(ru.title).toBe("Тестовая страница U4");

    await db.pageTranslation.deleteMany({ where: { pageId: createdId! } });
    await db.page.delete({ where: { id: createdId! } });
  });

  it("leaves a blank RU translation title falling back to the English title", async () => {
    const result = await savePageAction(buildFormData({
      [adminLocaleFieldName("ru", "title")]: "",
      [adminLocaleFieldName("ru", "body")]: "",
    }));
    expect(result.error).toBeUndefined();
    createdId = result.page!.id;

    const ru = await db.pageTranslation.findUnique({
      where: { pageId_locale: { pageId: createdId!, locale: "ru" } },
    });
    expect(ru).not.toBeNull();
    expect(ru!.title).toBe("U4 Integration Test Page"); // falls back to EN title

    await db.pageTranslation.deleteMany({ where: { pageId: createdId! } });
    await db.page.delete({ where: { id: createdId! } });
  });
});
