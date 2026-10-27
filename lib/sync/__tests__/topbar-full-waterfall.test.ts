import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * OWNER MODEL: top-bar AUTO/MANUAL → runCatalogConflictCheck → full catalog
 * waterfall must refresh products AND collections and drive both conflict counts.
 */

const mocks = vi.hoisted(() => ({
  hasShopifyAdminConfig: vi.fn(() => true),
  refreshShopifyProductState: vi.fn(),
  refreshShopifyCollectionState: vi.fn(),
  scanAndSaveCatalogPresence: vi.fn(),
  getLatestCatalogPresenceDifferences: vi.fn(async () => []),
  scanAndSaveCollectionPresence: vi.fn(),
  getLatestCollectionPresenceDifferences: vi.fn(async () => []),
  runTranslationReconciliation: vi.fn(),
  beginCatalogCheckRun: vi.fn(),
  finishCatalogCheckRun: vi.fn(),
  getPublishedStorefrontLocales: vi.fn(async () => []),
  getStorefrontLocales: vi.fn(async () => [
    { code: "en", name: "English", nativeName: "English", shopifyLocale: "en", isDefault: true, sortOrder: 0 },
    { code: "pt", name: "Portuguese", nativeName: "Português", shopifyLocale: "pt-PT", isDefault: false, sortOrder: 1 },
  ]),
  findManyCollections: vi.fn(),
  findManyProducts: vi.fn(),
  getLatestReconcileDifferences: vi.fn(async () => []),
  getLatestReconcileRun: vi.fn(async () => ({
    id: "run-1",
    trigger: "MANUAL",
    status: "SUCCEEDED",
    completedAt: "2026-10-24T12:00:00.000Z",
    differenceCount: 0,
    error: null,
  })),
  listUnseenIncomingProductUpdates: vi.fn(async () => []),
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
  beginCatalogCheckRun: mocks.beginCatalogCheckRun,
  finishCatalogCheckRun: mocks.finishCatalogCheckRun,
  heartbeatCatalogCheckRun: vi.fn(async () => undefined),
  getLatestReconcileDifferences: mocks.getLatestReconcileDifferences,
  getLatestReconcileRun: mocks.getLatestReconcileRun,
}));
vi.mock("@/lib/i18n/storefront-locale-cache", () => ({
  getPublishedStorefrontLocales: mocks.getPublishedStorefrontLocales,
  getStorefrontLocales: mocks.getStorefrontLocales,
}));
vi.mock("@/lib/shopify/catalog-conflict-review", () => ({
  listUnseenIncomingProductUpdates: mocks.listUnseenIncomingProductUpdates,
}));
vi.mock("@/lib/db", () => ({
  db: {
    collection: { findMany: mocks.findManyCollections },
    product: { findMany: mocks.findManyProducts },
  },
}));

import { runCatalogConflictCheck } from "@/lib/shopify/catalog-conflict-signals-server";
import { catalogConflictSignalsFromSyncResult, selectAdminNavSyncCounts } from "@/lib/sync";
import { refreshShopifyState } from "@/lib/sync/refresh-shopify-state";

describe("top-bar full catalog waterfall", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hasShopifyAdminConfig.mockReturnValue(true);
    mocks.beginCatalogCheckRun.mockResolvedValue({
      status: "started",
      run: { id: "run-1", error: null, status: "RUNNING", trigger: "MANUAL", completedAt: null, differenceCount: 0 },
    });
    mocks.finishCatalogCheckRun.mockResolvedValue({
      id: "run-1",
      error: null,
      status: "SUCCEEDED",
      trigger: "MANUAL",
      completedAt: "2026-10-24T12:00:00.000Z",
      differenceCount: 0,
    });
    mocks.runTranslationReconciliation.mockResolvedValue({
      run: { id: "run-1", error: null, status: "RUNNING", trigger: "MANUAL", completedAt: null, differenceCount: 0 },
      reused: false,
      checkedCount: 0,
      differenceCount: 0,
      translationStatus: "SUCCEEDED",
      translationError: null,
    });
    mocks.scanAndSaveCatalogPresence.mockResolvedValue(undefined);
    mocks.scanAndSaveCollectionPresence.mockResolvedValue(undefined);
    mocks.findManyProducts.mockResolvedValue([
      { shopifyProductId: "gid://shopify/Product/1", id: "prod-1", extras: { title: "Local" }, shopifySnapshot: { title: "Remote" } },
    ]);
    mocks.findManyCollections.mockResolvedValue([
      { shopifyCollectionId: "gid://shopify/Collection/1", id: "col-1", extras: { title: "Local Col" }, shopifySnapshot: { title: "Remote Col" } },
    ]);
  });

  it("catalog refresh updates Shopify copies for products AND collections", async () => {
    const result = await refreshShopifyState({ kind: "catalog" }, "admin", { trigger: "MANUAL" });

    expect(mocks.beginCatalogCheckRun).toHaveBeenCalledWith({
      trigger: "MANUAL",
      requestedBy: "admin",
    });
    expect(mocks.runTranslationReconciliation).toHaveBeenCalledWith({
      trigger: "MANUAL",
      requestedBy: "admin",
      attachToRunId: "run-1",
    });
    expect(mocks.scanAndSaveCatalogPresence).toHaveBeenCalledOnce();
    expect(mocks.scanAndSaveCollectionPresence).toHaveBeenCalledOnce();
    expect(mocks.refreshShopifyProductState).toHaveBeenCalledWith("gid://shopify/Product/1");
    expect(mocks.refreshShopifyCollectionState).toHaveBeenCalledWith("gid://shopify/Collection/1");
    expect(mocks.finishCatalogCheckRun).toHaveBeenCalled();
    expect(result.ok).toBe(true);
  });

  it("AUTO trigger is forwarded to the translation reconcile run", async () => {
    await refreshShopifyState({ kind: "catalog" }, "admin", { trigger: "AUTO" });
    expect(mocks.beginCatalogCheckRun).toHaveBeenCalledWith({
      trigger: "AUTO",
      requestedBy: "admin",
    });
    expect(mocks.runTranslationReconciliation).toHaveBeenCalledWith({
      trigger: "AUTO",
      requestedBy: "admin",
      attachToRunId: "run-1",
    });
  });

  it("runCatalogConflictCheck drives product AND collection conflict counts", async () => {
    const checked = await runCatalogConflictCheck("admin", { trigger: "MANUAL" });
    const nav = selectAdminNavSyncCounts(checked.result);
    const productSignals = catalogConflictSignalsFromSyncResult(checked.result, "PRODUCT", [
      { code: "en", name: "English", nativeName: "English" },
      { code: "pt", name: "Portuguese", nativeName: "Português" },
    ]);
    const collectionSignals = catalogConflictSignalsFromSyncResult(checked.result, "COLLECTION", [
      { code: "en", name: "English", nativeName: "English" },
      { code: "pt", name: "Portuguese", nativeName: "Português" },
    ]);

    // Commerce windows differ → product AND collection counts both move.
    expect(nav.products).toBeGreaterThan(0);
    expect(nav.collections).toBeGreaterThan(0);
    expect(productSignals.totalCount).toBeGreaterThan(0);
    expect(collectionSignals.totalCount).toBeGreaterThan(0);
    expect(mocks.refreshShopifyProductState).toHaveBeenCalled();
    expect(mocks.refreshShopifyCollectionState).toHaveBeenCalled();
  });
});

describe("reconcile route uses runCatalogConflictCheck for top-bar", () => {
  it("POST AUTO/MANUAL path references the single catalog entry point", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const route = readFileSync(
      join(process.cwd(), "app/admin/api/shopify/reconcile/route.ts"),
      "utf8",
    );
    expect(route).toMatch(/runCatalogConflictCheck/);
    expect(route).toMatch(/isFullCatalogTrigger/);
    expect(route).not.toMatch(/pullShopifyProduct/);
    expect(route).not.toMatch(/applyShopifyProductToSynarava/);
  });
});
