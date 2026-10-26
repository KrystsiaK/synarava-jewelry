import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Audit #6: after-save must not hold the save action for up to 11 minutes.
 * If alreadyRunning, return immediately; optional non-blocking follow-up only.
 */

const mocks = vi.hoisted(() => ({
  runCatalogConflictCheck: vi.fn(),
  after: vi.fn((cb: () => void) => {
    // Capture scheduled work without running it during the action.
    void cb;
  }),
}));

vi.mock("@/lib/shopify/catalog-conflict-signals-server", () => ({
  runCatalogConflictCheck: mocks.runCatalogConflictCheck,
}));
vi.mock("next/server", () => ({
  after: mocks.after,
}));

import { runAfterSaveCatalogConflictCheck } from "@/lib/shopify/after-save-catalog-check";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("runAfterSaveCatalogConflictCheck follow-up", () => {
  it("returns the check warning on success", async () => {
    mocks.runCatalogConflictCheck.mockResolvedValue({
      warning: "Collection presence could not be checked.",
      signals: { state: "ready", totalCount: 0, checkedAt: null, products: {}, recentlyUpdatedProducts: {} },
      result: { state: "ready", checkedAt: null, leaves: [], uncheckedCount: 0, recentlyUpdatedProducts: {} },
    });

    await expect(runAfterSaveCatalogConflictCheck("admin")).resolves.toEqual({
      alreadyRunning: false,
      ok: true,
      warning: "Collection presence could not be checked.",
    });
    expect(mocks.after).not.toHaveBeenCalled();
  });

  it("returns alreadyRunning immediately without polling when a check is active", async () => {
    mocks.runCatalogConflictCheck.mockResolvedValueOnce({
      alreadyRunning: true,
      warning: "already running",
      signals: { state: "checking", totalCount: 0, checkedAt: null, products: {}, recentlyUpdatedProducts: {} },
      result: { state: "checking", checkedAt: null, leaves: [], uncheckedCount: 0, recentlyUpdatedProducts: {} },
    });

    await expect(runAfterSaveCatalogConflictCheck("admin")).resolves.toEqual({
      alreadyRunning: true,
      ok: true,
      warning: "already running",
    });
    // Action returns after one call — no wait loop.
    expect(mocks.runCatalogConflictCheck).toHaveBeenCalledTimes(1);
    expect(mocks.after).toHaveBeenCalledTimes(1);
  });
});
