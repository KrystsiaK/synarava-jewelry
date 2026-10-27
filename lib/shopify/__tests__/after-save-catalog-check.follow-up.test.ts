import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * If a check already holds the single-flight lease, return alreadyRunning
 * honestly — never schedule a second run via after().
 */

const mocks = vi.hoisted(() => ({
  runSyncWaterfall: vi.fn(),
  after: vi.fn(),
}));

vi.mock("@/lib/sync", () => ({
  runSyncWaterfall: mocks.runSyncWaterfall,
}));
vi.mock("next/server", () => ({
  after: mocks.after,
}));

import { runAfterSaveCatalogConflictCheck } from "@/lib/shopify/after-save-catalog-check";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("runAfterSaveCatalogConflictCheck alreadyRunning", () => {
  it("returns the check warning on success without scheduling follow-up", async () => {
    mocks.runSyncWaterfall.mockResolvedValue({
      warning: "translations not rechecked",
      result: { state: "ready", checkedAt: null, leaves: [], uncheckedCount: 0, recentlyUpdatedProducts: {} },
    });

    await expect(
      runAfterSaveCatalogConflictCheck("admin", { kind: "product", productId: "p1" }),
    ).resolves.toEqual({
      alreadyRunning: false,
      ok: true,
      warning: "translations not rechecked",
    });
    expect(mocks.after).not.toHaveBeenCalled();
  });

  it("returns alreadyRunning immediately without scheduling a second run", async () => {
    mocks.runSyncWaterfall.mockResolvedValueOnce({
      alreadyRunning: true,
      warning: "already running",
      result: { state: "checking", checkedAt: null, leaves: [], uncheckedCount: 0, recentlyUpdatedProducts: {} },
    });

    await expect(
      runAfterSaveCatalogConflictCheck("admin", { kind: "product", productId: "p1" }),
    ).resolves.toEqual({
      alreadyRunning: true,
      ok: true,
      warning: "already running",
    });
    expect(mocks.runSyncWaterfall).toHaveBeenCalledTimes(1);
    expect(mocks.after).not.toHaveBeenCalled();
  });
});
