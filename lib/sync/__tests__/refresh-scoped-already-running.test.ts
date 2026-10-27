import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Audit #5: scoped rechecks must return alreadyRunning + warning instead of
 * silent ok:true while another catalog run holds the lease.
 */

const mocks = vi.hoisted(() => ({
  hasShopifyAdminConfig: vi.fn(() => true),
  refreshShopifyProductState: vi.fn(),
  refreshShopifyCollectionState: vi.fn(),
  runTranslationReconciliation: vi.fn(),
  findUniqueProduct: vi.fn(),
  findUniqueCollection: vi.fn(),
  getPublishedStorefrontLocales: vi.fn(async () => []),
}));

vi.mock("@/lib/shopify/admin", () => ({
  hasShopifyAdminConfig: mocks.hasShopifyAdminConfig,
}));
vi.mock("@/lib/shopify/product-sync", () => ({
  refreshShopifyProductState: mocks.refreshShopifyProductState,
}));
vi.mock("@/lib/shopify/collection-presence-server", () => ({
  refreshShopifyCollectionState: mocks.refreshShopifyCollectionState,
  scanAndSaveCollectionPresence: vi.fn(),
}));
vi.mock("@/lib/shopify/catalog-presence-server", () => ({
  scanAndSaveCatalogPresence: vi.fn(),
}));
vi.mock("@/lib/shopify/reconciliation-run", () => ({
  runTranslationReconciliation: mocks.runTranslationReconciliation,
  heartbeatCatalogCheckRun: vi.fn(),
  beginCatalogCheckRun: vi.fn(),
  finishCatalogCheckRun: vi.fn(),
}));
vi.mock("@/lib/i18n/storefront-locale-cache", () => ({
  getPublishedStorefrontLocales: mocks.getPublishedStorefrontLocales,
}));
vi.mock("@/lib/db", () => ({
  db: {
    product: { findUnique: mocks.findUniqueProduct, findMany: vi.fn() },
    collection: { findUnique: mocks.findUniqueCollection, findMany: vi.fn() },
  },
}));

import { refreshShopifyState } from "@/lib/sync/refresh-shopify-state";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.hasShopifyAdminConfig.mockReturnValue(true);
  mocks.findUniqueProduct.mockResolvedValue({ shopifyProductId: "gid://shopify/Product/1" });
  mocks.findUniqueCollection.mockResolvedValue({ shopifyCollectionId: "gid://shopify/Collection/1" });
});

describe("refreshShopifyState scoped alreadyRunning", () => {
  it("returns alreadyRunning + warning for product scope when another run is active", async () => {
    mocks.runTranslationReconciliation.mockResolvedValue({
      run: { id: "active", error: null },
      reused: true,
      reason: "already_running",
    });

    await expect(
      refreshShopifyState({ kind: "product", productId: "p1" }, "admin"),
    ).resolves.toMatchObject({
      ok: true,
      alreadyRunning: true,
      warning: "already running",
      runId: "active",
    });
  });

  it("returns alreadyRunning + warning for collection scope when another run is active", async () => {
    mocks.runTranslationReconciliation.mockResolvedValue({
      run: { id: "active", error: null },
      reused: true,
      reason: "already_running",
    });

    await expect(
      refreshShopifyState({ kind: "collection", collectionId: "c1" }, "admin"),
    ).resolves.toMatchObject({
      ok: true,
      alreadyRunning: true,
      warning: "already running",
      runId: "active",
    });
  });
});
