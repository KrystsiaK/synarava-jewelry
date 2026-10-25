import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  storefrontLocaleFindUnique: vi.fn(),
  storefrontLocaleUpsert: vi.fn(),
  productFindMany: vi.fn(),
  productUpdate: vi.fn(),
  collectionFindMany: vi.fn(),
  collectionUpdate: vi.fn(),
  pageFindMany: vi.fn(),
  pageUpdate: vi.fn(),
  productTranslationFindMany: vi.fn(),
  productTranslationUpsert: vi.fn(),
  collectionTranslationFindMany: vi.fn(),
  collectionTranslationUpsert: vi.fn(),
  pageTranslationFindMany: vi.fn(),
  pageTranslationUpsert: vi.fn(),
  localizedHandleRedirectFindMany: vi.fn(),
  localizedHandleRedirectUpsert: vi.fn(),
  translationCacheFindUnique: vi.fn(),
  translationCacheUpsert: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    storefrontLocale: {
      findUnique: mocks.storefrontLocaleFindUnique,
      upsert: mocks.storefrontLocaleUpsert,
    },
    product: {
      findMany: mocks.productFindMany,
      update: mocks.productUpdate,
    },
    collection: {
      findMany: mocks.collectionFindMany,
      update: mocks.collectionUpdate,
    },
    page: {
      findMany: mocks.pageFindMany,
      update: mocks.pageUpdate,
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
  previewLanguageBundleImport,
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
  mocks.translationCacheFindUnique.mockResolvedValue(null);
  mocks.productTranslationUpsert.mockResolvedValue({});
  mocks.collectionTranslationUpsert.mockResolvedValue({});
  mocks.pageTranslationUpsert.mockResolvedValue({});
  mocks.localizedHandleRedirectUpsert.mockResolvedValue({});
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
    expect(bundle.translationSnapshots).toEqual([]);
    expect(bundle.shopifyTranslations).toEqual([]);
    expect(verifyLanguageBundle(bundle)).toEqual({ ok: true });

    const result = await importLanguageBundle(bundle, "pt");
    expect(result).toEqual({
      locale: "pt",
      products: 1,
      collections: 0,
      pages: 0,
      redirects: 0,
    });
    expect(mocks.productTranslationUpsert).toHaveBeenCalled();

    await expect(importLanguageBundle(bundle, "ru")).rejects.toThrow(/does not match/);
  });

  it("previews import diffs without writing", async () => {
    mocks.productTranslationFindMany.mockResolvedValueOnce([
      {
        productId: "p1",
        locale: "pt",
        title: "Old title",
        localizedHandle: "anel",
        shortDescription: null,
        description: null,
        seoTitle: null,
        seoDescription: null,
      },
    ]);
    const bundle = await exportLanguageBundle("pt");
    const { checksum: _checksum, ...payload } = bundle;
    void _checksum;
    // Mutate title so preview reports a field change.
    const next = attachLanguageBundleChecksum({
      ...payload,
      productTranslations: [{ ...(bundle.productTranslations[0] as object), title: "New title" }],
    });
    const preview = await previewLanguageBundleImport(next, "pt");
    expect(preview.counts.products).toBe(1);
    expect(preview.counts.fieldsChanged).toBeGreaterThan(0);
    expect(preview.samples.some((sample) => sample.fieldKey === "title")).toBe(true);
    expect(mocks.productTranslationUpsert).not.toHaveBeenCalled();
  });

  it("ignores legacy translationSnapshots on import without writing them", async () => {
    const bundle = attachLanguageBundleChecksum({
      schemaVersion: LANGUAGE_BUNDLE_SCHEMA_VERSION,
      locale: "pt",
      exportedAt: "2026-10-21T00:00:00.000Z",
      registry: null,
      productTranslations: [],
      collectionTranslations: [],
      pageTranslations: [],
      handleRedirects: [],
      translationSnapshots: [{ bindingId: "b1", values: { title: "Anel" } }],
      translationCache: null,
      shopifyTranslations: [],
    });
    await expect(importLanguageBundle(bundle, "pt")).resolves.toMatchObject({
      locale: "pt",
      products: 0,
    });
  });

  it("exports and imports default locale from Product/Collection/Page base columns", async () => {
    mocks.storefrontLocaleFindUnique.mockResolvedValue({
      code: "en",
      routeSegment: "en",
      shopifyLocale: "en",
      intlLocale: "en-IE",
      name: "English",
      nativeName: "English",
      isDefault: true,
      status: "PUBLISHED",
      sortOrder: 0,
    });
    mocks.productFindMany.mockResolvedValue([
      {
        id: "p1",
        name: "Ring",
        slug: "ring",
        shortDescription: "Short",
        description: "Desc",
        materialLine: null,
        symbolismLabel: null,
        symbolismTitle: null,
        symbolismBody: null,
        symbolismBody2: null,
        details: null,
        seoTitle: "SEO",
        seoDescription: null,
      },
    ]);
    mocks.collectionFindMany.mockResolvedValue([]);
    mocks.pageFindMany.mockResolvedValue([]);
    mocks.productUpdate.mockResolvedValue({});

    const bundle = await exportLanguageBundle("en");
    expect(bundle.productTranslations).toEqual([
      expect.objectContaining({ productId: "p1", locale: "en", title: "Ring", localizedHandle: "ring" }),
    ]);
    expect(mocks.productTranslationFindMany).not.toHaveBeenCalled();

    await importLanguageBundle(bundle, "en");
    expect(mocks.productUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "p1" },
        data: expect.objectContaining({ name: "Ring", slug: "ring" }),
      }),
    );
    expect(mocks.productTranslationUpsert).not.toHaveBeenCalled();
  });
});
