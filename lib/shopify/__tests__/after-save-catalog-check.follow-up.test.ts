import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Audit #6: after-save returns warning; if alreadyRunning, wait once then
 * re-run a single follow-up check.
 */

const mocks = vi.hoisted(() => ({
  runCatalogConflictCheck: vi.fn(),
  getLatestReconcileRun: vi.fn(),
}));

vi.mock("@/lib/shopify/catalog-conflict-signals-server", () => ({
  runCatalogConflictCheck: mocks.runCatalogConflictCheck,
}));
vi.mock("@/lib/shopify/reconciliation-run", () => ({
  getLatestReconcileRun: mocks.getLatestReconcileRun,
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
  });

  it("waits for the active run then runs one follow-up when alreadyRunning", async () => {
    mocks.runCatalogConflictCheck
      .mockResolvedValueOnce({
        alreadyRunning: true,
        warning: "already running",
        signals: { state: "checking", totalCount: 0, checkedAt: null, products: {}, recentlyUpdatedProducts: {} },
        result: { state: "checking", checkedAt: null, leaves: [], uncheckedCount: 0, recentlyUpdatedProducts: {} },
      })
      .mockResolvedValueOnce({
        warning: "translations not rechecked",
        signals: { state: "ready", totalCount: 0, checkedAt: null, products: {}, recentlyUpdatedProducts: {} },
        result: { state: "ready", checkedAt: null, leaves: [], uncheckedCount: 0, recentlyUpdatedProducts: {} },
      });

    mocks.getLatestReconcileRun
      .mockResolvedValueOnce({
        id: "active",
        status: "RUNNING",
        trigger: "MANUAL",
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        startedAt: new Date().toISOString(),
        completedAt: null,
        checkedCount: 0,
        differenceCount: 0,
        error: null,
      })
      .mockResolvedValueOnce({
        id: "active",
        status: "SUCCEEDED",
        trigger: "MANUAL",
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        checkedCount: 1,
        differenceCount: 0,
        error: null,
      });

    await expect(runAfterSaveCatalogConflictCheck("admin")).resolves.toEqual({
      alreadyRunning: false,
      ok: true,
      warning: "translations not rechecked",
    });
    expect(mocks.runCatalogConflictCheck).toHaveBeenCalledTimes(2);
  });
});
