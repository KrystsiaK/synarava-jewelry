import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchShopifyShopIdentity: vi.fn(),
  ensureShopifyStoreBinding: vi.fn(),
  runSyncWaterfall: vi.fn(),
  getStorefrontLocales: vi.fn(),
  cleanupSyncHistoryBestEffort: vi.fn(),
  catalogConflictSignalsFromSyncResult: vi.fn(),
}));

vi.mock("@/lib/shopify/admin", () => ({
  fetchShopifyShopIdentity: mocks.fetchShopifyShopIdentity,
}));
vi.mock("@/lib/shopify/store-binding", () => ({
  ensureShopifyStoreBinding: mocks.ensureShopifyStoreBinding,
  assertShopifyStoreBinding: vi.fn(),
}));
vi.mock("@/lib/sync", () => ({
  runSyncWaterfall: mocks.runSyncWaterfall,
  catalogConflictSignalsFromSyncResult: mocks.catalogConflictSignalsFromSyncResult,
}));
vi.mock("@/lib/i18n/storefront-locale-cache", () => ({
  getStorefrontLocales: mocks.getStorefrontLocales,
}));
vi.mock("@/lib/shopify/sync-history-retention", () => ({
  cleanupSyncHistoryBestEffort: mocks.cleanupSyncHistoryBestEffort,
}));

import { runCatalogConflictCheck } from "@/lib/shopify/catalog-conflict-signals-server";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetchShopifyShopIdentity.mockResolvedValue({
    name: "Synarava",
    myshopifyDomain: "synarava.myshopify.com",
  });
  mocks.ensureShopifyStoreBinding.mockResolvedValue({
    status: "MATCH",
    currentShopDomain: "synarava.myshopify.com",
  });
  mocks.getStorefrontLocales.mockResolvedValue([]);
  mocks.catalogConflictSignalsFromSyncResult.mockReturnValue({
    products: {},
    totalConflicts: 0,
  });
  mocks.runSyncWaterfall.mockResolvedValue({
    result: { entities: [] },
    warning: undefined,
    alreadyRunning: false,
  });
});

describe("runCatalogConflictCheck store binding", () => {
  it("fetches shop identity and ensures binding before the waterfall", async () => {
    const order: string[] = [];
    mocks.fetchShopifyShopIdentity.mockImplementation(async () => {
      order.push("identity");
      return { name: "Synarava", myshopifyDomain: "synarava.myshopify.com" };
    });
    mocks.ensureShopifyStoreBinding.mockImplementation(async () => {
      order.push("ensure");
      return { status: "MATCH", currentShopDomain: "synarava.myshopify.com" };
    });
    mocks.runSyncWaterfall.mockImplementation(async () => {
      order.push("waterfall");
      return { result: { entities: [] }, alreadyRunning: false };
    });

    await runCatalogConflictCheck("admin", { trigger: "MANUAL" });

    expect(order).toEqual(["identity", "ensure", "waterfall"]);
    expect(mocks.ensureShopifyStoreBinding).toHaveBeenCalledWith("synarava.myshopify.com");
  });

  it("does not start the waterfall when binding mismatches", async () => {
    mocks.ensureShopifyStoreBinding.mockRejectedValue(
      new Error("This catalog is linked to old-shop.myshopify.com"),
    );
    await expect(runCatalogConflictCheck("admin", { trigger: "MANUAL" }))
      .rejects.toThrow(/linked to old-shop/);
    expect(mocks.runSyncWaterfall).not.toHaveBeenCalled();
  });
});
