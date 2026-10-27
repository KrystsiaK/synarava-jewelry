import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  runSyncWaterfall: vi.fn(),
}));

vi.mock("@/lib/sync", () => ({
  runSyncWaterfall: mocks.runSyncWaterfall,
}));

import { runAfterSaveCatalogConflictCheck } from "@/lib/shopify/after-save-catalog-check";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("runAfterSaveCatalogConflictCheck", () => {
  it("runs a scoped product waterfall — never full catalog", async () => {
    mocks.runSyncWaterfall.mockResolvedValue({
      warning: undefined,
      result: { state: "ready", checkedAt: null, leaves: [], uncheckedCount: 0, recentlyUpdatedProducts: {} },
    });

    await expect(
      runAfterSaveCatalogConflictCheck("admin", { kind: "product", productId: "p1" }),
    ).resolves.toMatchObject({
      alreadyRunning: false,
      ok: true,
    });
    expect(mocks.runSyncWaterfall).toHaveBeenCalledTimes(1);
    expect(mocks.runSyncWaterfall).toHaveBeenCalledWith({
      scope: { kind: "product", productId: "p1" },
      requestedBy: "admin",
    });
  });

  it("runs a scoped collection waterfall", async () => {
    mocks.runSyncWaterfall.mockResolvedValue({
      result: { state: "ready", checkedAt: null, leaves: [], uncheckedCount: 0, recentlyUpdatedProducts: {} },
    });

    await expect(
      runAfterSaveCatalogConflictCheck("admin", { kind: "collection", collectionId: "c1" }),
    ).resolves.toMatchObject({ alreadyRunning: false, ok: true });
    expect(mocks.runSyncWaterfall).toHaveBeenCalledWith({
      scope: { kind: "collection", collectionId: "c1" },
      requestedBy: "admin",
    });
  });

  it("never throws when the check fails — save must stay successful", async () => {
    mocks.runSyncWaterfall.mockRejectedValue(new Error("network down"));
    await expect(
      runAfterSaveCatalogConflictCheck("admin", { kind: "product", productId: "p1" }),
    ).resolves.toMatchObject({
      alreadyRunning: false,
      ok: false,
      warning: "network down",
    });
  });
});
