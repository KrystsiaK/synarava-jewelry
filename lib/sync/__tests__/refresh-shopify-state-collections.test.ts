import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  hasShopifyAdminConfig: vi.fn(() => true),
  refreshShopifyProductState: vi.fn(),
  refreshShopifyCollectionState: vi.fn(),
  scanAndSaveCatalogPresence: vi.fn(),
  getLatestCatalogPresenceDifferences: vi.fn(),
  scanAndSaveCollectionPresence: vi.fn(),
  getLatestCollectionPresenceDifferences: vi.fn(),
  runTranslationReconciliation: vi.fn(),
  getPublishedStorefrontLocales: vi.fn(async () => []),
  findManyCollections: vi.fn(),
  findUniqueCollection: vi.fn(),
  findManyProducts: vi.fn(),
  findUniqueProduct: vi.fn(),
}));

vi.mock("@/lib/shopify/admin", () => ({
  hasShopifyAdminConfig: mocks.hasShopifyAdminConfig,
}));
vi.mock("@/lib/shopify/product-sync", () => ({
  refreshShopifyProductState: mocks.refreshShopifyProductState,
}));
vi.mock("@/lib/shopify/collection-presence-server", () => ({
  refreshShopifyCollectionState: mocks.refreshShopifyCollectionState,
  scanAndSaveCollectionPresence: mocks.scanAndSaveCollectionPresence,
  getLatestCollectionPresenceDifferences: mocks.getLatestCollectionPresenceDifferences,
}));
vi.mock("@/lib/shopify/catalog-presence-server", () => ({
  scanAndSaveCatalogPresence: mocks.scanAndSaveCatalogPresence,
  getLatestCatalogPresenceDifferences: mocks.getLatestCatalogPresenceDifferences,
}));
vi.mock("@/lib/shopify/reconciliation-run", () => ({
  runTranslationReconciliation: mocks.runTranslationReconciliation,
}));
vi.mock("@/lib/i18n/storefront-locale-cache", () => ({
  getPublishedStorefrontLocales: mocks.getPublishedStorefrontLocales,
}));
vi.mock("@/lib/db", () => ({
  db: {
    collection: {
      findMany: mocks.findManyCollections,
      findUnique: mocks.findUniqueCollection,
    },
    product: {
      findMany: mocks.findManyProducts,
      findUnique: mocks.findUniqueProduct,
    },
  },
}));

import { refreshShopifyState } from "@/lib/sync/refresh-shopify-state";

describe("refreshShopifyState — collections commerce", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hasShopifyAdminConfig.mockReturnValue(true);
    mocks.runTranslationReconciliation.mockResolvedValue({ run: { id: "run-1", error: null } });
    mocks.scanAndSaveCollectionPresence.mockResolvedValue(undefined);
  });

  it("refreshes each linked collection commerce window (no PR4 stub warning)", async () => {
    mocks.findManyCollections.mockResolvedValue([
      { shopifyCollectionId: "gid://shopify/Collection/1" },
      { shopifyCollectionId: "gid://shopify/Collection/2" },
    ]);

    const result = await refreshShopifyState({ kind: "collections" }, "admin");

    expect(mocks.refreshShopifyCollectionState).toHaveBeenCalledTimes(2);
    expect(mocks.refreshShopifyCollectionState).toHaveBeenNthCalledWith(1, "gid://shopify/Collection/1");
    expect(mocks.refreshShopifyCollectionState).toHaveBeenNthCalledWith(2, "gid://shopify/Collection/2");
    expect(result.ok).toBe(true);
    expect(result.warning).toBeUndefined();
    expect(result.warning ?? "").not.toMatch(/PR4|#245|sync-unification/i);
  });

  it("refreshes one collection then translations without Markets jargon", async () => {
    mocks.findUniqueCollection.mockResolvedValue({ shopifyCollectionId: "gid://shopify/Collection/9" });
    mocks.getPublishedStorefrontLocales.mockResolvedValue([
      { code: "pt", shopifyLocale: "pt-PT", isDefault: false },
    ]);

    const result = await refreshShopifyState(
      { kind: "collection", collectionId: "local-9", locale: "pt" },
      "admin",
    );

    expect(mocks.refreshShopifyCollectionState).toHaveBeenCalledWith("gid://shopify/Collection/9");
    expect(result.ok).toBe(true);
    expect(result.warning ?? "").not.toMatch(/Shopify Markets/i);
  });

  it("skips unpublished locale quietly (no Markets toast text)", async () => {
    mocks.findUniqueCollection.mockResolvedValue({ shopifyCollectionId: "gid://shopify/Collection/9" });
    mocks.getPublishedStorefrontLocales.mockResolvedValue([]);

    const result = await refreshShopifyState(
      { kind: "collection", collectionId: "local-9", locale: "ru" },
      "admin",
    );

    expect(mocks.refreshShopifyCollectionState).toHaveBeenCalledOnce();
    expect(mocks.runTranslationReconciliation).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true, runId: null });
  });
});
