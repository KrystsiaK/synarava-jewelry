import { beforeEach, describe, expect, it, vi } from "vitest";

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
  mocks.getLatestReconcileRun.mockResolvedValue(null);
});

describe("runAfterSaveCatalogConflictCheck", () => {
  it("triggers exactly one full catalog check", async () => {
    mocks.runCatalogConflictCheck.mockResolvedValue({
      signals: { state: "ready", totalCount: 0, checkedAt: null, products: {}, recentlyUpdatedProducts: {} },
      result: { state: "ready", checkedAt: null, leaves: [], uncheckedCount: 0, recentlyUpdatedProducts: {} },
    });

    await expect(runAfterSaveCatalogConflictCheck("admin")).resolves.toMatchObject({
      alreadyRunning: false,
      ok: true,
    });
    expect(mocks.runCatalogConflictCheck).toHaveBeenCalledTimes(1);
    expect(mocks.runCatalogConflictCheck).toHaveBeenCalledWith("admin", { trigger: "MANUAL" });
  });

  it("never throws when the check fails — save must stay successful", async () => {
    mocks.runCatalogConflictCheck.mockRejectedValue(new Error("network down"));
    await expect(runAfterSaveCatalogConflictCheck("admin")).resolves.toMatchObject({
      alreadyRunning: false,
      ok: false,
      warning: "network down",
    });
  });
});
