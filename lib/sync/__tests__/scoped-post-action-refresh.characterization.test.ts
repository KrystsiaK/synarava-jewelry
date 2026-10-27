import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * PR1 characterization: post-action scoped refresh refreshes exactly one
 * product + its translation scope, never scans presence for other entities.
 * Top-bar catalog path still scans presence + stamps via finishCatalogCheckRun.
 * Single-flight lease returns alreadyRunning.
 */

const mocks = vi.hoisted(() => ({
  hasShopifyAdminConfig: vi.fn(() => true),
  refreshShopifyProductState: vi.fn(),
  refreshShopifyCollectionState: vi.fn(),
  scanAndSaveCatalogPresence: vi.fn(),
  scanAndSaveCollectionPresence: vi.fn(),
  runTranslationReconciliation: vi.fn(),
  beginCatalogCheckRun: vi.fn(),
  finishCatalogCheckRun: vi.fn(),
  getPublishedStorefrontLocales: vi.fn(async () => []),
  findUniqueProduct: vi.fn(),
  findManyProducts: vi.fn(),
  findManyCollections: vi.fn(),
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
}));
vi.mock("@/lib/shopify/catalog-presence-server", () => ({
  scanAndSaveCatalogPresence: mocks.scanAndSaveCatalogPresence,
}));
vi.mock("@/lib/shopify/reconciliation-run", () => ({
  runTranslationReconciliation: mocks.runTranslationReconciliation,
  beginCatalogCheckRun: mocks.beginCatalogCheckRun,
  finishCatalogCheckRun: mocks.finishCatalogCheckRun,
  heartbeatCatalogCheckRun: vi.fn(async () => undefined),
}));
vi.mock("@/lib/i18n/storefront-locale-cache", () => ({
  getPublishedStorefrontLocales: mocks.getPublishedStorefrontLocales,
}));
vi.mock("@/lib/db", () => ({
  db: {
    product: {
      findUnique: mocks.findUniqueProduct,
      findMany: mocks.findManyProducts,
    },
    collection: { findMany: mocks.findManyCollections },
  },
}));

import { refreshShopifyState } from "@/lib/sync/refresh-shopify-state";

describe("scoped post-action refresh characterization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hasShopifyAdminConfig.mockReturnValue(true);
    mocks.findUniqueProduct.mockResolvedValue({ shopifyProductId: "gid://shopify/Product/99" });
    mocks.findManyProducts.mockResolvedValue([
      { shopifyProductId: "gid://shopify/Product/1" },
      { shopifyProductId: "gid://shopify/Product/2" },
    ]);
    mocks.findManyCollections.mockResolvedValue([
      { shopifyCollectionId: "gid://shopify/Collection/1" },
    ]);
    mocks.runTranslationReconciliation.mockResolvedValue({
      run: {
        id: "locale-run",
        error: null,
        status: "SUCCEEDED",
        trigger: "LOCALE",
        completedAt: "2026-10-27T12:00:00.000Z",
        differenceCount: 0,
      },
      reused: false,
    });
    mocks.beginCatalogCheckRun.mockResolvedValue({
      status: "started",
      run: { id: "catalog-run", error: null, status: "RUNNING", trigger: "MANUAL", completedAt: null, differenceCount: 0 },
    });
    mocks.finishCatalogCheckRun.mockResolvedValue({
      id: "catalog-run",
      error: null,
      status: "SUCCEEDED",
      trigger: "MANUAL",
      completedAt: "2026-10-27T12:05:00.000Z",
      differenceCount: 0,
    });
    mocks.scanAndSaveCatalogPresence.mockResolvedValue([]);
    mocks.scanAndSaveCollectionPresence.mockResolvedValue([]);
  });

  it("product scope refreshes exactly one product + scoped translations; no presence scan", async () => {
    const result = await refreshShopifyState(
      { kind: "product", productId: "p1" },
      "admin",
    );

    expect(result).toMatchObject({ ok: true, runId: "locale-run" });
    expect(result.runStatus).toBeUndefined();
    expect(mocks.refreshShopifyProductState).toHaveBeenCalledTimes(1);
    expect(mocks.refreshShopifyProductState).toHaveBeenCalledWith("gid://shopify/Product/99");
    expect(mocks.refreshShopifyCollectionState).not.toHaveBeenCalled();
    expect(mocks.scanAndSaveCatalogPresence).not.toHaveBeenCalled();
    expect(mocks.scanAndSaveCollectionPresence).not.toHaveBeenCalled();
    expect(mocks.beginCatalogCheckRun).not.toHaveBeenCalled();
    expect(mocks.finishCatalogCheckRun).not.toHaveBeenCalled();
    expect(mocks.runTranslationReconciliation).toHaveBeenCalledWith({
      trigger: "LOCALE",
      requestedBy: "admin",
      scope: { entityType: "PRODUCT", entityId: "p1" },
    });
  });

  it("product scope returns alreadyRunning when single-flight lease is held", async () => {
    mocks.runTranslationReconciliation.mockResolvedValueOnce({
      run: { id: "active", error: null, status: "RUNNING", trigger: "MANUAL", completedAt: null, differenceCount: 0 },
      reused: true,
      reason: "already_running",
    });

    await expect(
      refreshShopifyState({ kind: "product", productId: "p1" }, "admin"),
    ).resolves.toMatchObject({
      ok: true,
      alreadyRunning: true,
      warning: "already running",
    });
    expect(mocks.scanAndSaveCatalogPresence).not.toHaveBeenCalled();
  });

  it("top-bar catalog path still scans presence for all entities and finishes catalog run", async () => {
    const refreshed = await refreshShopifyState({ kind: "catalog" }, "admin", { trigger: "MANUAL" });
    expect(refreshed.runStatus).toBe("SUCCEEDED");
    expect(mocks.scanAndSaveCatalogPresence).toHaveBeenCalledOnce();
    expect(mocks.scanAndSaveCollectionPresence).toHaveBeenCalledOnce();
    expect(mocks.refreshShopifyProductState).toHaveBeenCalledTimes(2);
    expect(mocks.refreshShopifyCollectionState).toHaveBeenCalledTimes(1);
    expect(mocks.beginCatalogCheckRun).toHaveBeenCalledWith({
      trigger: "MANUAL",
      requestedBy: "admin",
    });
    expect(mocks.finishCatalogCheckRun).toHaveBeenCalled();
  });

  it("after-save helper and entity actions never pass catalog scope", () => {
    const helper = readFileSync(join(process.cwd(), "lib/shopify/after-save-catalog-check.ts"), "utf8");
    expect(helper).toMatch(/runSyncWaterfall/);
    expect(helper).not.toMatch(/kind:\s*"catalog"/);
    expect(helper).not.toMatch(/runCatalogConflictCheck/);

    for (const rel of [
      "app/admin/actions/products.ts",
      "app/admin/actions/collections.ts",
      "app/admin/actions/sku-assign.ts",
      "app/admin/actions/sync.ts",
      "lib/sync/conflicts/service.ts",
    ]) {
      const source = readFileSync(join(process.cwd(), rel), "utf8");
      expect(source, rel).toMatch(/runAfterSaveCatalogConflictCheck/);
      // Every call must include a second arg object — never username-only.
      expect(source, rel).not.toMatch(/runAfterSaveCatalogConflictCheck\([^,\n)]+\)\s*;/);
    }
  });
});
