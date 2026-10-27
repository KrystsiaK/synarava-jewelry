import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Behavioral: if the post-Apply recheck throws / never returns, caches are
 * already invalidated from the write phase.
 */

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  revalidateStorefront: vi.fn(),
  hasShopifyAdminConfig: vi.fn(() => true),
  applyCatalogConflictResolution: vi.fn(),
  applyCollectionConflictResolution: vi.fn(),
  markIncomingProductUpdates: vi.fn(),
  runAfterSaveCatalogConflictCheck: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));
vi.mock("@/lib/content/revalidate-storefront", () => ({
  revalidateStorefront: mocks.revalidateStorefront,
}));
vi.mock("@/lib/shopify/admin", () => ({
  hasShopifyAdminConfig: mocks.hasShopifyAdminConfig,
}));
vi.mock("@/lib/shopify/after-save-catalog-check", () => ({
  runAfterSaveCatalogConflictCheck: mocks.runAfterSaveCatalogConflictCheck,
}));
vi.mock("@/lib/shopify/catalog-conflict-apply", () => ({
  applyCatalogConflictResolution: mocks.applyCatalogConflictResolution,
  previewCatalogConflictResolution: vi.fn(),
}));
vi.mock("@/lib/shopify/collection-conflict-apply", () => ({
  applyCollectionConflictResolution: mocks.applyCollectionConflictResolution,
  previewCollectionConflictResolution: vi.fn(),
}));
vi.mock("@/lib/shopify/catalog-conflict-review", () => ({
  markIncomingProductUpdates: mocks.markIncomingProductUpdates,
}));
vi.mock("@/lib/shopify/catalog-conflict", () => ({
  loadProductConflictFromSyncResult: vi.fn(),
}));
vi.mock("@/lib/shopify/collection-conflict", () => ({
  loadCollectionConflictFromSyncResult: vi.fn(),
}));
vi.mock("@/lib/shopify/catalog-conflict-signals-server", () => ({
  getCatalogConflictSignals: vi.fn(),
  getCollectionConflictSignals: vi.fn(),
  runProductConflictCheck: vi.fn(),
}));

import { applyResolution } from "@/lib/sync/conflicts/service";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.hasShopifyAdminConfig.mockReturnValue(true);
  mocks.markIncomingProductUpdates.mockResolvedValue(undefined);
});

describe("revalidate-before-recheck behavior", () => {
  it("product Apply invalidates before recheck; caches stay invalidated if recheck throws", async () => {
    mocks.applyCatalogConflictResolution.mockResolvedValue({
      appliedCount: 1,
      failedCount: 0,
      results: [{ ok: true, productId: "p1", fieldKey: "title", message: "ok" }],
    });
    mocks.runAfterSaveCatalogConflictCheck.mockRejectedValue(new Error("recheck hung / threw"));

    const callOrder: string[] = [];
    mocks.revalidatePath.mockImplementation(() => { callOrder.push("revalidatePath"); });
    mocks.revalidateStorefront.mockImplementation(() => { callOrder.push("revalidateStorefront"); });
    mocks.runAfterSaveCatalogConflictCheck.mockImplementation(async () => {
      callOrder.push("recheck");
      throw new Error("recheck hung / threw");
    });

    const result = await applyResolution(
      "product",
      {
        entries: [{
          productId: "p1",
          fieldKey: "title",
          direction: "SHOPIFY_TO_SYNARAVA",
          expectedLocalFingerprint: "a",
          expectedShopifyFingerprint: "b",
        }],
        acknowledgeClears: false,
      },
      "admin",
    );

    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/products");
    expect(mocks.revalidateStorefront).toHaveBeenCalled();
    expect(callOrder.indexOf("revalidatePath")).toBeLessThan(callOrder.indexOf("recheck"));
    expect(callOrder.indexOf("revalidateStorefront")).toBeLessThan(callOrder.indexOf("recheck"));
    // Recheck failure must not gate Apply success — caches already invalidated.
    expect(result.error).toBeUndefined();
    expect(result.outcome?.appliedCount).toBe(1);
    expect(result.success).toMatch(/1 change applied/);
  });

  it("collection Apply (incl. Take-Shopify delete path) invalidates before recheck", async () => {
    mocks.applyCollectionConflictResolution.mockResolvedValue({
      appliedCount: 1,
      failedCount: 0,
      results: [{ ok: true, collectionId: "c1", localCollectionId: "c1", fieldKey: "presence:collection", message: "removed" }],
    });
    const callOrder: string[] = [];
    mocks.revalidatePath.mockImplementation(() => { callOrder.push("revalidatePath"); });
    mocks.revalidateStorefront.mockImplementation(() => { callOrder.push("revalidateStorefront"); });
    mocks.runAfterSaveCatalogConflictCheck.mockImplementation(async () => {
      callOrder.push("recheck");
      return { alreadyRunning: false, ok: true };
    });

    await applyResolution(
      "collection",
      {
        entries: [{
          collectionId: "c1",
          fieldKey: "presence:collection",
          direction: "SHOPIFY_TO_SYNARAVA",
          expectedLocalFingerprint: "a",
          expectedShopifyFingerprint: "b",
        }],
        acknowledgeClears: true,
      },
      "admin",
    );

    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/collections");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/collections/c1");
    expect(mocks.revalidateStorefront).toHaveBeenCalled();
    expect(callOrder.indexOf("revalidatePath")).toBeLessThan(callOrder.indexOf("recheck"));
  });
});
