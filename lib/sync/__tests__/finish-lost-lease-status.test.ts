import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Audit #4: after finishCatalogCheckRun, return the status actually written.
 * A lost-lease no-op must not report SUCCEEDED (caller must not stamp checkedAt).
 */

const mocks = vi.hoisted(() => ({
  hasShopifyAdminConfig: vi.fn(() => true),
  beginCatalogCheckRun: vi.fn(),
  finishCatalogCheckRun: vi.fn(),
  runTranslationReconciliation: vi.fn(),
  scanAndSaveCatalogPresence: vi.fn(),
  scanAndSaveCollectionPresence: vi.fn(),
  heartbeatCatalogCheckRun: vi.fn(),
  findManyProducts: vi.fn(async () => []),
  findManyCollections: vi.fn(async () => []),
  getPublishedStorefrontLocales: vi.fn(async () => []),
}));

vi.mock("@/lib/shopify/admin", () => ({
  hasShopifyAdminConfig: mocks.hasShopifyAdminConfig,
}));
vi.mock("@/lib/shopify/product-sync", () => ({
  refreshShopifyProductState: vi.fn(),
}));
vi.mock("@/lib/shopify/collection-presence-server", () => ({
  refreshShopifyCollectionState: vi.fn(),
  scanAndSaveCollectionPresence: mocks.scanAndSaveCollectionPresence,
}));
vi.mock("@/lib/shopify/catalog-presence-server", () => ({
  scanAndSaveCatalogPresence: mocks.scanAndSaveCatalogPresence,
}));
vi.mock("@/lib/shopify/reconciliation-run", () => ({
  beginCatalogCheckRun: mocks.beginCatalogCheckRun,
  finishCatalogCheckRun: mocks.finishCatalogCheckRun,
  runTranslationReconciliation: mocks.runTranslationReconciliation,
  heartbeatCatalogCheckRun: mocks.heartbeatCatalogCheckRun,
}));
vi.mock("@/lib/i18n/storefront-locale-cache", () => ({
  getPublishedStorefrontLocales: mocks.getPublishedStorefrontLocales,
}));
vi.mock("@/lib/db", () => ({
  db: {
    product: { findMany: mocks.findManyProducts },
    collection: { findMany: mocks.findManyCollections },
  },
}));

import { refreshShopifyState } from "@/lib/sync/refresh-shopify-state";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.hasShopifyAdminConfig.mockReturnValue(true);
  mocks.beginCatalogCheckRun.mockResolvedValue({
    status: "started",
    run: { id: "run-1", status: "RUNNING" },
  });
  mocks.runTranslationReconciliation.mockResolvedValue({
    run: { id: "run-1", error: null },
    reused: false,
    checkedCount: 0,
    differenceCount: 0,
    translationStatus: "SUCCEEDED",
  });
  mocks.scanAndSaveCatalogPresence.mockResolvedValue([]);
  mocks.scanAndSaveCollectionPresence.mockResolvedValue([]);
});

describe("refreshShopifyState lost-lease finish status", () => {
  it("returns FAILED runStatus when finish is a no-op on an expired run", async () => {
    mocks.finishCatalogCheckRun.mockResolvedValue({
      id: "run-1",
      status: "FAILED",
      error: "Check timed out (lease expired after 10 minutes).",
    });

    const result = await refreshShopifyState({ kind: "catalog" }, "admin");

    expect(mocks.finishCatalogCheckRun).toHaveBeenCalledWith(
      "run-1",
      expect.objectContaining({ status: "SUCCEEDED" }),
    );
    expect(result.runStatus).toBe("FAILED");
    expect(result.runStatus).not.toBe("SUCCEEDED");
  });

  it("heartbeats after each presence scan on catalog scope", async () => {
    mocks.finishCatalogCheckRun.mockResolvedValue({
      id: "run-1",
      status: "SUCCEEDED",
    });

    await refreshShopifyState({ kind: "catalog" }, "admin");

    expect(mocks.heartbeatCatalogCheckRun).toHaveBeenCalledWith("run-1");
    expect(mocks.heartbeatCatalogCheckRun.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
