import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  aggregate: vi.fn(),
  divergenceCount: vi.fn(),
  transaction: vi.fn(),
  hasWriteLocalesScope: vi.fn(),
  shopLocaleEnable: vi.fn(),
  shopLocaleUpdate: vi.fn(),
  shopLocaleDisable: vi.fn(),
  invalidate: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    storefrontLocale: {
      findUnique: mocks.findUnique,
      findFirst: mocks.findFirst,
      create: mocks.create,
      update: mocks.update,
      aggregate: mocks.aggregate,
    },
    shopifyFieldDivergence: { count: mocks.divergenceCount },
    productTranslation: { deleteMany: vi.fn() },
    collectionTranslation: { deleteMany: vi.fn() },
    pageTranslation: { deleteMany: vi.fn() },
    localizedHandleRedirect: { deleteMany: vi.fn() },
    shopifyTranslationSnapshot: { deleteMany: vi.fn() },
    translationCache: { deleteMany: vi.fn() },
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/shopify/locale-mutations", () => ({
  hasWriteLocalesScope: mocks.hasWriteLocalesScope,
  shopLocaleEnable: mocks.shopLocaleEnable,
  shopLocaleUpdate: mocks.shopLocaleUpdate,
  shopLocaleDisable: mocks.shopLocaleDisable,
}));

vi.mock("@/lib/i18n/storefront-locale-cache", () => ({
  invalidateStorefrontLocaleCache: mocks.invalidate,
}));

import {
  addStorefrontLanguage,
  deleteStorefrontLanguageData,
  hideStorefrontLanguage,
} from "@/lib/i18n/language-lifecycle";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.hasWriteLocalesScope.mockResolvedValue(false);
  mocks.findFirst.mockResolvedValue(null);
  mocks.aggregate.mockResolvedValue({ _max: { sortOrder: 2 } });
  mocks.create.mockResolvedValue({});
  mocks.update.mockResolvedValue({});
  mocks.transaction.mockResolvedValue([]);
});

describe("language lifecycle", () => {
  it("adds a draft language without Shopify writes when write_locales is missing", async () => {
    const result = await addStorefrontLanguage({
      code: "de",
      routeSegment: "de",
      shopifyLocale: "de",
      intlLocale: "de",
      name: "German",
      nativeName: "Deutsch",
    });
    expect(result.requiresWriteLocales).toBe(true);
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ code: "de", status: "DRAFT", isPublished: false }),
      }),
    );
    expect(mocks.shopLocaleEnable).not.toHaveBeenCalled();
  });

  it("hides a published language into Retired", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "1",
      code: "pt",
      shopifyLocale: "pt-PT",
      isDefault: false,
      status: "PUBLISHED",
      isPublished: true,
      retiredAt: null,
      deletedAt: null,
    });
    const result = await hideStorefrontLanguage("pt");
    expect(result.success).toMatch(/Hid pt/);
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "RETIRED", isPublished: false }),
      }),
    );
  });

  it("refuses delete without export checksum and retention", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "1",
      code: "pt",
      isDefault: false,
      status: "RETIRED",
      retiredAt: new Date(),
      deletedAt: null,
    });
    expect(
      await deleteStorefrontLanguageData({ code: "pt", typedCode: "pt", exportChecksum: "" }),
    ).toMatchObject({ error: expect.stringMatching(/Export/i) });
  });
});
