import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Conflict preview/apply must refuse while a catalog check is QUEUED/RUNNING
 * within lease; FAILED / expired lease must not block.
 */

const mocks = vi.hoisted(() => ({
  hasShopifyAdminConfig: vi.fn(() => true),
  isCatalogCheckBlockingWrites: vi.fn(async () => false),
  previewCatalogConflictResolution: vi.fn(),
  applyCatalogConflictResolution: vi.fn(),
  previewCollectionConflictResolution: vi.fn(),
  applyCollectionConflictResolution: vi.fn(),
  runProductConflictCheck: vi.fn(),
  markIncomingProductUpdates: vi.fn(),
  revalidatePath: vi.fn(),
  revalidateStorefront: vi.fn(),
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
vi.mock("@/lib/shopify/reconciliation-run", () => ({
  CATALOG_CHECK_RUNNING_WRITE_ERROR: "A Shopify check is running, try again when it finishes",
  isCatalogCheckBlockingWrites: mocks.isCatalogCheckBlockingWrites,
}));
vi.mock("@/lib/shopify/catalog-conflict-apply", () => ({
  previewCatalogConflictResolution: mocks.previewCatalogConflictResolution,
  applyCatalogConflictResolution: mocks.applyCatalogConflictResolution,
}));
vi.mock("@/lib/shopify/collection-conflict-apply", () => ({
  previewCollectionConflictResolution: mocks.previewCollectionConflictResolution,
  applyCollectionConflictResolution: mocks.applyCollectionConflictResolution,
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
  runProductConflictCheck: mocks.runProductConflictCheck,
}));
vi.mock("@/lib/shopify/after-save-catalog-check", () => ({
  runAfterSaveCatalogConflictCheck: mocks.runAfterSaveCatalogConflictCheck,
}));

import {
  applyResolution,
  previewResolution,
} from "@/lib/sync/conflicts/service";

const RUNNING_ERROR = "A Shopify check is running, try again when it finishes";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.hasShopifyAdminConfig.mockReturnValue(true);
  mocks.isCatalogCheckBlockingWrites.mockResolvedValue(false);
  mocks.markIncomingProductUpdates.mockResolvedValue(undefined);
  mocks.runAfterSaveCatalogConflictCheck.mockResolvedValue(undefined);
  mocks.previewCatalogConflictResolution.mockResolvedValue({
    truncated: false,
    excluded: [],
    entries: [],
  });
  mocks.applyCatalogConflictResolution.mockResolvedValue({
    appliedCount: 1,
    failedCount: 0,
    results: [{ ok: true, productId: "p1", fieldKey: "title", message: "ok" }],
  });
});

describe("conflict write guard while catalog check runs", () => {
  it("preview rejects while an active check blocks writes", async () => {
    mocks.isCatalogCheckBlockingWrites.mockResolvedValue(true);

    await expect(
      previewResolution("product", { kind: "MANUAL", selections: [] }, "admin"),
    ).resolves.toEqual({ error: RUNNING_ERROR });
    expect(mocks.previewCatalogConflictResolution).not.toHaveBeenCalled();
  });

  it("apply rejects while an active check blocks writes", async () => {
    mocks.isCatalogCheckBlockingWrites.mockResolvedValue(true);

    await expect(
      applyResolution(
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
      ),
    ).resolves.toEqual({ error: RUNNING_ERROR });
    expect(mocks.applyCatalogConflictResolution).not.toHaveBeenCalled();
  });

  it("preview and apply succeed after FAILED / expired (not blocking)", async () => {
    // FAILED or lease-expired → isCatalogCheckBlockingWrites false (expire-on-read).
    mocks.isCatalogCheckBlockingWrites.mockResolvedValue(false);

    await expect(
      previewResolution("product", { kind: "MANUAL", selections: [] }, "admin"),
    ).resolves.toMatchObject({ preview: expect.any(Object) });
    expect(mocks.previewCatalogConflictResolution).toHaveBeenCalled();

    const applied = await applyResolution(
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
    expect(applied.error).toBeUndefined();
    expect(applied.outcome?.appliedCount).toBe(1);
    expect(mocks.applyCatalogConflictResolution).toHaveBeenCalled();
  });
});
