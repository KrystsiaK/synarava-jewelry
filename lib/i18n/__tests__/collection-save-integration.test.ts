import { beforeEach, describe, expect, it, vi } from "vitest";

// Real DB, real Prisma writes against the local dev Postgres — only auth
// and the registry locale list are mocked, since those need Next's
// request-scoped headers()/cookies(), unavailable outside a real request.
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
vi.mock("@/lib/media/local-upload", () => ({ saveCollectionImageUpload: vi.fn() }));

import { db } from "@/lib/db";
import { saveCollectionAction } from "@/app/admin/actions/collections";

function buildFormData(overrides: Record<string, string> = {}) {
  const fd = new FormData();
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const defaults: Record<string, string> = {
    collectionId: "",
    slug: `u4-test-collection-${unique}`,
    code: `U4T-${unique}`,
    name: "U4 Integration Test Collection",
    description: "EN description.",
    manifesto: "EN manifesto.",
    searchSummary: "EN search summary.",
    existingHeroImageUrl: "https://example.com/hero.jpg",
    workflowState: "DRAFT",
    ptName: "Coleção de Teste U4",
    ptReviewed: "on",
    ruName: "Тестовая коллекция U4",
    ruReviewed: "on",
  };
  for (const [key, value] of Object.entries({ ...defaults, ...overrides })) fd.set(key, value);
  return fd;
}

describe("saveCollectionAction — N-locale translation save (real DB)", () => {
  let createdId: string | null = null;

  beforeEach(() => {
    createdId = null;
  });

  it("creates EN/PT/RU CollectionTranslation rows in one save, with correct registry locale codes", async () => {
    const result = await saveCollectionAction({}, buildFormData());

    expect(result.error).toBeUndefined();
    expect(result.collection).toBeTruthy();
    createdId = result.collection!.id;

    const rows = await db.collectionTranslation.findMany({
      where: { collectionId: createdId! },
      orderBy: { locale: "asc" },
    });
    expect(rows.map((r) => r.locale)).toEqual(["en", "pt", "ru"]);

    const en = rows.find((r) => r.locale === "en")!;
    const pt = rows.find((r) => r.locale === "pt")!;
    const ru = rows.find((r) => r.locale === "ru")!;

    expect(en.name).toBe("U4 Integration Test Collection");
    expect(en.reviewStatus).toBe("REVIEWED");

    expect(pt.name).toBe("Coleção de Teste U4");
    expect(pt.reviewStatus).toBe("REVIEWED");
    expect(pt.syncStatus).toBe("PENDING");

    expect(ru.name).toBe("Тестовая коллекция U4");
    expect(ru.reviewStatus).toBe("REVIEWED");
    expect(ru.syncStatus).toBe("PENDING");

    await db.collectionTranslation.deleteMany({ where: { collectionId: createdId! } });
    await db.collection.delete({ where: { id: createdId! } });
  });

  it("leaves an unreviewed, blank RU translation as DRAFT/NOT_APPLICABLE and falls back its name to English", async () => {
    const result = await saveCollectionAction({}, buildFormData({ ruName: "", ruReviewed: "" }));
    expect(result.error).toBeUndefined();
    createdId = result.collection!.id;

    const ru = await db.collectionTranslation.findUnique({
      where: { collectionId_locale: { collectionId: createdId!, locale: "ru" } },
    });
    expect(ru).not.toBeNull();
    expect(ru!.name).toBe("U4 Integration Test Collection"); // falls back to EN name
    expect(ru!.reviewStatus).toBe("DRAFT");
    expect(ru!.syncStatus).toBe("NOT_APPLICABLE");

    await db.collectionTranslation.deleteMany({ where: { collectionId: createdId! } });
    await db.collection.delete({ where: { id: createdId! } });
  });
});
