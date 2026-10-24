import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  runCatalogConflictCheck: vi.fn(),
}));

vi.mock("@/lib/shopify/catalog-conflict-signals-server", () => ({
  runCatalogConflictCheck: mocks.runCatalogConflictCheck,
}));

import { runAfterSaveCatalogConflictCheck } from "@/lib/shopify/after-save-catalog-check";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("runAfterSaveCatalogConflictCheck", () => {
  it("triggers exactly one full catalog check", async () => {
    mocks.runCatalogConflictCheck.mockResolvedValue({
      signals: { state: "ready", totalCount: 0, checkedAt: null, products: {}, recentlyUpdatedProducts: {} },
      result: { state: "ready", checkedAt: null, leaves: [], recentlyUpdatedProducts: {} },
    });

    await expect(runAfterSaveCatalogConflictCheck("admin")).resolves.toMatchObject({
      alreadyRunning: false,
      ok: true,
    });
    expect(mocks.runCatalogConflictCheck).toHaveBeenCalledTimes(1);
    expect(mocks.runCatalogConflictCheck).toHaveBeenCalledWith("admin", { trigger: "MANUAL" });
  });

  it("returns alreadyRunning when the server refuses a second start", async () => {
    mocks.runCatalogConflictCheck.mockResolvedValue({
      alreadyRunning: true,
      warning: "already running",
      signals: { state: "checking", totalCount: 0, checkedAt: null, products: {}, recentlyUpdatedProducts: {} },
      result: { state: "checking", checkedAt: null, leaves: [], recentlyUpdatedProducts: {} },
    });

    await expect(runAfterSaveCatalogConflictCheck("admin")).resolves.toEqual({
      alreadyRunning: true,
      ok: true,
      warning: "already running",
    });
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
