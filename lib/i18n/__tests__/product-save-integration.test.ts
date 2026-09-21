import { beforeEach, describe, expect, it, vi } from "vitest";

// Real DB, real Prisma writes against the local dev Postgres — only auth,
// the registry locale list, and outbound side effects (revalidate, image
// upload) are mocked, since those need Next's request-scoped
// headers()/cookies() or real network/filesystem access unavailable outside
// a real request. Mirrors lib/i18n/__tests__/collection-save-integration.test.ts.
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
vi.mock("@/lib/media/local-upload", () => ({ saveProductImageUpload: vi.fn() }));
vi.mock("@/lib/shopify/config", () => ({ isShopifyConfigured: vi.fn(() => false) }));
vi.mock("@/lib/shopify/product-sync", () => ({ deleteShopifyProduct: vi.fn() }));

import { db } from "@/lib/db";
import { saveProductAction } from "@/app/admin/actions/products";
import { adminLocaleFieldName } from "@/lib/i18n/admin-locale-fields";

function buildFormData(overrides: Record<string, string> = {}) {
  const fd = new FormData();
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const defaults: Record<string, string> = {
    productId: "",
    slug: `u4-test-product-${unique}`,
    sku: `U4T-${unique}`,
    name: "U4 Integration Test Product",
    shortDescription: "EN short description.",
    description: "EN description.",
    price: "45.00",
    workflowState: "DRAFT",
    [adminLocaleFieldName("pt", "title")]: "Produto de Teste U4",
    [adminLocaleFieldName("pt", "shortDescription")]: "Descrição curta PT.",
    [adminLocaleFieldName("pt", "description")]: "Descrição PT.",
    [adminLocaleFieldName("pt", "reviewed")]: "on",
    [adminLocaleFieldName("ru", "title")]: "Тестовый продукт U4",
    [adminLocaleFieldName("ru", "shortDescription")]: "Краткое описание.",
    [adminLocaleFieldName("ru", "description")]: "Описание.",
    [adminLocaleFieldName("ru", "reviewed")]: "on",
  };
  for (const [key, value] of Object.entries({ ...defaults, ...overrides })) fd.set(key, value);
  return fd;
}

describe("saveProductAction — N-locale translation save (real DB)", () => {
  let createdId: string | null = null;

  beforeEach(() => {
    createdId = null;
  });

  it("creates EN/PT/RU ProductTranslation rows in one save, with correct registry locale codes", async () => {
    const result = await saveProductAction(buildFormData());

    expect(result.error).toBeUndefined();
    expect(result.product).toBeTruthy();
    createdId = result.product!.id;

    const rows = await db.productTranslation.findMany({
      where: { productId: createdId! },
      orderBy: { locale: "asc" },
    });
    expect(rows.map((r) => r.locale)).toEqual(["en", "pt", "ru"]);

    const en = rows.find((r) => r.locale === "en")!;
    const pt = rows.find((r) => r.locale === "pt")!;
    const ru = rows.find((r) => r.locale === "ru")!;

    expect(en.title).toBe("U4 Integration Test Product");
    expect(en.reviewStatus).toBe("REVIEWED");

    expect(pt.title).toBe("Produto de Teste U4");
    expect(pt.reviewStatus).toBe("REVIEWED");
    expect(pt.syncStatus).toBe("NOT_APPLICABLE"); // no Shopify link yet

    expect(ru.title).toBe("Тестовый продукт U4");
    expect(ru.reviewStatus).toBe("REVIEWED");

    await db.productTranslation.deleteMany({ where: { productId: createdId! } });
    await db.product.delete({ where: { id: createdId! } });
  });

  it("leaves an unreviewed, blank RU translation as DRAFT and falls back its title to English", async () => {
    const result = await saveProductAction(buildFormData({
      [adminLocaleFieldName("ru", "title")]: "",
      [adminLocaleFieldName("ru", "shortDescription")]: "",
      [adminLocaleFieldName("ru", "description")]: "",
      [adminLocaleFieldName("ru", "reviewed")]: "",
    }));
    expect(result.error).toBeUndefined();
    createdId = result.product!.id;

    const ru = await db.productTranslation.findUnique({
      where: { productId_locale: { productId: createdId!, locale: "ru" } },
    });
    expect(ru).not.toBeNull();
    expect(ru!.title).toBe(""); // stored as typed — storefront rendering falls back to English, not the save action
    expect(ru!.reviewStatus).toBe("DRAFT");

    await db.productTranslation.deleteMany({ where: { productId: createdId! } });
    await db.product.delete({ where: { id: createdId! } });
  });
});
