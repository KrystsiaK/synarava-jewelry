import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  aggregate: vi.fn(),
  divergenceCount: vi.fn(),
  transaction: vi.fn(),
  siteSettingFindUnique: vi.fn(),
  siteSettingUpsert: vi.fn(),
  siteSettingDeleteMany: vi.fn(),
  hasWriteLocalesScope: vi.fn(),
  shopLocaleEnable: vi.fn(),
  shopLocaleUpdate: vi.fn(),
  shopLocaleDisable: vi.fn(),
  invalidate: vi.fn(),
  exportLanguageBundle: vi.fn(),
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
    translationCache: { deleteMany: vi.fn() },
    siteSetting: {
      findUnique: mocks.siteSettingFindUnique,
      upsert: mocks.siteSettingUpsert,
      deleteMany: mocks.siteSettingDeleteMany,
    },
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

vi.mock("@/lib/i18n/language-bundle", () => ({
  exportLanguageBundle: mocks.exportLanguageBundle,
}));

import {
  addStorefrontLanguage,
  deleteStorefrontLanguageData,
  exportStorefrontLanguage,
  hideStorefrontLanguage,
} from "@/lib/i18n/language-lifecycle";

const RETIRED_PAST_RETENTION = {
  id: "1",
  code: "pt",
  shopifyLocale: "pt-PT",
  isDefault: false,
  status: "RETIRED",
  isPublished: false,
  retiredAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
  deletedAt: null,
};

function stubFreshReceipt(checksum: string) {
  mocks.siteSettingFindUnique.mockResolvedValue({
    value: { checksum, exportedAt: new Date().toISOString() },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.hasWriteLocalesScope.mockResolvedValue(false);
  mocks.findFirst.mockResolvedValue(null);
  mocks.aggregate.mockResolvedValue({ _max: { sortOrder: 2 } });
  mocks.create.mockResolvedValue({});
  mocks.update.mockResolvedValue({});
  mocks.transaction.mockResolvedValue([]);
  mocks.divergenceCount.mockResolvedValue(0);
  mocks.siteSettingFindUnique.mockResolvedValue(null);
  mocks.siteSettingUpsert.mockResolvedValue({});
  mocks.siteSettingDeleteMany.mockResolvedValue({ count: 1 });
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

  it("records a SiteSetting export receipt when exporting", async () => {
    mocks.exportLanguageBundle.mockResolvedValue({
      locale: "pt",
      checksum: "bundle-sha",
      schemaVersion: 1,
    });
    const bundle = await exportStorefrontLanguage("pt");
    expect(bundle.checksum).toBe("bundle-sha");
    expect(mocks.siteSettingUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: "language-export-receipt:pt" },
        create: expect.objectContaining({
          key: "language-export-receipt:pt",
          value: expect.objectContaining({ checksum: "bundle-sha" }),
        }),
      }),
    );
  });

  it("refuses delete when no server-side export receipt exists", async () => {
    mocks.siteSettingFindUnique.mockResolvedValue(null);
    expect(
      await deleteStorefrontLanguageData({ code: "pt", typedCode: "pt", exportChecksum: "anything" }),
    ).toMatchObject({ error: expect.stringMatching(/No recent server-side export receipt/i) });
    expect(mocks.shopLocaleDisable).not.toHaveBeenCalled();
  });

  it("refuses delete when the client checksum does not match the receipt", async () => {
    stubFreshReceipt("server-checksum");
    expect(
      await deleteStorefrontLanguageData({
        code: "pt",
        typedCode: "pt",
        exportChecksum: "client-forged",
      }),
    ).toMatchObject({ error: expect.stringMatching(/does not match/i) });
    expect(mocks.shopLocaleDisable).not.toHaveBeenCalled();
  });

  it("refuses delete when the export receipt is older than 60 minutes", async () => {
    mocks.siteSettingFindUnique.mockResolvedValue({
      value: {
        checksum: "old-checksum",
        exportedAt: new Date(Date.now() - 61 * 60 * 1000).toISOString(),
      },
    });
    expect(
      await deleteStorefrontLanguageData({
        code: "pt",
        typedCode: "pt",
        exportChecksum: "old-checksum",
      }),
    ).toMatchObject({ error: expect.stringMatching(/expired/i) });
    expect(mocks.shopLocaleDisable).not.toHaveBeenCalled();
  });

  it("deletes language data when receipt checksum matches and is fresh", async () => {
    stubFreshReceipt("good-checksum");
    mocks.findUnique.mockResolvedValue(RETIRED_PAST_RETENTION);
    mocks.hasWriteLocalesScope.mockResolvedValue(true);
    mocks.shopLocaleDisable.mockResolvedValue(undefined);

    const result = await deleteStorefrontLanguageData({
      code: "pt",
      typedCode: "pt",
      exportChecksum: "good-checksum",
    });

    expect(result).toMatchObject({ success: expect.stringMatching(/Deleted translation data for pt/i) });
    expect(mocks.shopLocaleDisable).toHaveBeenCalledWith("pt-PT");
    expect(mocks.transaction).toHaveBeenCalled();
    expect(mocks.siteSettingDeleteMany).toHaveBeenCalledWith({
      where: { key: "language-export-receipt:pt" },
    });
  });
});
