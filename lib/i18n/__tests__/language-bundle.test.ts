import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  storefrontLocaleFindUnique: vi.fn(),
  storefrontLocaleUpsert: vi.fn(),
  productTranslationFindMany: vi.fn(),
  productTranslationUpsert: vi.fn(),
  collectionTranslationFindMany: vi.fn(),
  collectionTranslationUpsert: vi.fn(),
  pageTranslationFindMany: vi.fn(),
  pageTranslationUpsert: vi.fn(),
  localizedHandleRedirectFindMany: vi.fn(),
  localizedHandleRedirectUpsert: vi.fn(),
  shopifyTranslationSnapshotFindMany: vi.fn(),
  shopifyTranslationSnapshotUpsert: vi.fn(),
  translationCacheFindUnique: vi.fn(),
  translationCacheUpsert: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    storefrontLocale: {
      findUnique: mocks.storefrontLocaleFindUnique,
      upsert: mocks.storefrontLocaleUpsert,
    },
    productTranslation: {
      findMany: mocks.productTranslationFindMany,
      upsert: mocks.productTranslationUpsert,
    },
    collectionTranslation: {
      findMany: mocks.collectionTranslationFindMany,
      upsert: mocks.collectionTranslationUpsert,
    },
    pageTranslation: {
      findMany: mocks.pageTranslationFindMany,
      upsert: mocks.pageTranslationUpsert,
    },
    localizedHandleRedirect: {
      findMany: mocks.localizedHandleRedirectFindMany,
      upsert: mocks.localizedHandleRedirectUpsert,
    },
    shopifyTranslationSnapshot: {
      findMany: mocks.shopifyTranslationSnapshotFindMany,
      upsert: mocks.shopifyTranslationSnapshotUpsert,
    },
    translationCache: {
      findUnique: mocks.translationCacheFindUnique,
      upsert: mocks.translationCacheUpsert,
    },
  },
}));

import {
  attachLanguageBundleChecksum,
  exportLanguageBundle,
  importLanguageBundle,
  LANGUAGE_BUNDLE_SCHEMA_VERSION,
  verifyLanguageBundle,
  type LanguageBundle,
} from "@/lib/i18n/language-bundle";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.storefrontLocaleFindUnique.mockResolvedValue({
    code: "pt",
    routeSegment: "pt",
    shopifyLocale: "pt-PT",
    intlLocale: "pt-PT",
    name: "Portuguese",
    nativeName: "Português",
    isDefault: false,
    status: "PUBLISHED",
    sortOrder: 1,
  });
  mocks.productTranslationFindMany.mockResolvedValue([
    {
      id: "t1",
      productId: "p1",
      locale: "pt",
      title: "Anel",
      localizedHandle: "anel",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]);
  mocks.collectionTranslationFindMany.mockResolvedValue([]);
  mocks.pageTranslationFindMany.mockResolvedValue([]);
  mocks.localizedHandleRedirectFindMany.mockResolvedValue([]);
  mocks.shopifyTranslationSnapshotFindMany.mockResolvedValue([
    {
      id: "s1",
      bindingId: "b1",
      locale: "pt",
      values: { title: "Anel" },
      syncedAt: new Date("2026-01-01T00:00:00.000Z"),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]);
  mocks.translationCacheFindUnique.mockResolvedValue(null);
  mocks.productTranslationUpsert.mockResolvedValue({});
  mocks.collectionTranslationUpsert.mockResolvedValue({});
  mocks.pageTranslationUpsert.mockResolvedValue({});
  mocks.localizedHandleRedirectUpsert.mockResolvedValue({});
  mocks.shopifyTranslationSnapshotUpsert.mockResolvedValue({});
  mocks.translationCacheUpsert.mockResolvedValue({});
  mocks.storefrontLocaleUpsert.mockResolvedValue({});
});

describe("language bundle checksum", () => {
  it("accepts a freshly signed bundle and rejects tampering", () => {
    const bundle = attachLanguageBundleChecksum({
      schemaVersion: LANGUAGE_BUNDLE_SCHEMA_VERSION,
      locale: "pt",
      exportedAt: "2026-10-21T00:00:00.000Z",
      registry: null,
      productTranslations: [],
      collectionTranslations: [],
      pageTranslations: [],
      handleRedirects: [],
      translationSnapshots: [],
      translationCache: null,
      shopifyTranslations: [],
    });
    expect(verifyLanguageBundle(bundle)).toEqual({ ok: true });
    const tampered: LanguageBundle = { ...bundle, productTranslations: [{ productId: "x" }] };
    expect(verifyLanguageBundle(tampered).ok).toBe(false);
  });
});

describe("exportLanguageBundle / importLanguageBundle", () => {
  it("round-trips product rows and refuses a mismatched locale", async () => {
    const bundle = await exportLanguageBundle("pt");
    expect(bundle.locale).toBe("pt");
    expect(bundle.productTranslations).toHaveLength(1);
    expect(bundle.shopifyTranslations).toHaveLength(1);
    expect(verifyLanguageBundle(bundle)).toEqual({ ok: true });

    const result = await importLanguageBundle(bundle, "pt");
    expect(result).toEqual({
      locale: "pt",
      products: 1,
      collections: 0,
      pages: 0,
      redirects: 0,
      snapshots: 1,
    });
    expect(mocks.productTranslationUpsert).toHaveBeenCalled();

    await expect(importLanguageBundle(bundle, "ru")).rejects.toThrow(/does not match/);
  });
});
