import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Conflict preview/apply/whole-record must refuse while a FULL catalog check is
 * QUEUED/RUNNING within lease; FAILED / expired / scoped after-save must not block.
 */

const mocks = vi.hoisted(() => ({
  hasShopifyAdminConfig: vi.fn(() => true),
  getCatalogCheckConflictWriteBlock: vi.fn(async (): Promise<string | null> => null),
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
  getCatalogCheckConflictWriteBlock: mocks.getCatalogCheckConflictWriteBlock,
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
const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.hasShopifyAdminConfig.mockReturnValue(true);
  mocks.getCatalogCheckConflictWriteBlock.mockResolvedValue(null);
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
    mocks.getCatalogCheckConflictWriteBlock.mockResolvedValue(RUNNING_ERROR);

    await expect(
      previewResolution("product", { kind: "MANUAL", selections: [] }, "admin"),
    ).resolves.toEqual({ error: RUNNING_ERROR });
    expect(mocks.previewCatalogConflictResolution).not.toHaveBeenCalled();
  });

  it("apply rejects while an active check blocks writes", async () => {
    mocks.getCatalogCheckConflictWriteBlock.mockResolvedValue(RUNNING_ERROR);

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
    mocks.getCatalogCheckConflictWriteBlock.mockResolvedValue(null);

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

  it("DB error inside write-block guard returns { error } from preview/apply", async () => {
    mocks.getCatalogCheckConflictWriteBlock.mockRejectedValue(new Error("db connection lost"));

    await expect(
      previewResolution("product", { kind: "MANUAL", selections: [] }, "admin"),
    ).resolves.toEqual({ error: "db connection lost" });
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
    ).resolves.toEqual({ error: "db connection lost" });
    expect(mocks.previewCatalogConflictResolution).not.toHaveBeenCalled();
    expect(mocks.applyCatalogConflictResolution).not.toHaveBeenCalled();
  });

  it("after-save scoped recheck does not leave the write gate blocked for the next apply", async () => {
    mocks.getCatalogCheckConflictWriteBlock.mockResolvedValue(null);
    mocks.runAfterSaveCatalogConflictCheck.mockResolvedValue({
      alreadyRunning: false,
      ok: true,
    });

    const first = await applyResolution(
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
    expect(first.error).toBeUndefined();
    expect(mocks.runAfterSaveCatalogConflictCheck).toHaveBeenCalled();

    // Same session: scoped LOCALE run is not a FULL catalog run — gate stays open.
    const second = await applyResolution(
      "product",
      {
        entries: [{
          productId: "p1",
          fieldKey: "title",
          direction: "SHOPIFY_TO_SYNARAVA",
          expectedLocalFingerprint: "a2",
          expectedShopifyFingerprint: "b2",
        }],
        acknowledgeClears: false,
      },
      "admin",
    );
    expect(second.error).toBeUndefined();
    expect(mocks.applyCatalogConflictResolution).toHaveBeenCalledTimes(2);
  });

  it("ONE helper: FULL-only getLatestReconcileRun; whole-record actions share it", () => {
    const reconciliation = read("lib/shopify/reconciliation-run.ts");
    const service = read("lib/sync/conflicts/service.ts");
    const actions = read("app/admin/actions/sync.ts");

    expect(reconciliation).toMatch(/export async function getCatalogCheckConflictWriteBlock/);
    expect(reconciliation).toMatch(/getLatestReconcileRun/);
    expect(reconciliation).toMatch(/"scope" IS NULL OR "scope" = 'null'::jsonb/);
    expect(reconciliation).not.toMatch(/export async function isCatalogCheckBlockingWrites/);

    expect(service).toMatch(/getCatalogCheckConflictWriteBlock\s*\(/);
    expect(actions).toMatch(/getCatalogCheckConflictWriteBlock\s*\(/);
    expect(actions).toMatch(/pushSingleProductToShopifyAction/);
    expect(actions).toMatch(/pullSingleProductFromShopifyAction/);
    // Guard lives inside try so DB errors become { error }.
    expect(service).toMatch(/try\s*\{[\s\S]*getCatalogCheckConflictWriteBlock/);
  });
});
