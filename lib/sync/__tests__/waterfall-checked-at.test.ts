import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Audit #1: waterfall must stamp checkedAt only after a fresh SUCCEEDED run —
 * never after reused / already-running / partial / failed refreshes.
 */

const mocks = vi.hoisted(() => ({
  refreshShopifyState: vi.fn(),
  readSynaravaStateForCompare: vi.fn(),
  compareSyncState: vi.fn(),
}));

vi.mock("@/lib/sync/refresh-shopify-state", () => ({
  refreshShopifyState: mocks.refreshShopifyState,
}));
vi.mock("@/lib/sync/read-synarava-state", () => ({
  readSynaravaStateForCompare: mocks.readSynaravaStateForCompare,
}));
vi.mock("@/lib/sync/compare", () => ({
  compareSyncState: mocks.compareSyncState,
}));

import { runSyncWaterfall } from "@/lib/sync/waterfall";

const compareInput = { connected: true, checkedAt: null };
const syncResult = {
  checkedAt: null,
  state: "ready" as const,
  leaves: [],
  uncheckedCount: 0,
  recentlyUpdatedProducts: {},
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.readSynaravaStateForCompare.mockResolvedValue(compareInput);
  mocks.compareSyncState.mockReturnValue(syncResult);
});

describe("runSyncWaterfall checkedAt stamp", () => {
  it("stamps checkedAt only when refresh SUCCEEDED and was not reused", async () => {
    mocks.refreshShopifyState.mockResolvedValue({
      ok: true,
      runId: "r1",
      runStatus: "SUCCEEDED",
      reused: false,
    });

    await runSyncWaterfall({
      scope: { kind: "catalog" },
      requestedBy: "admin",
      trigger: "MANUAL",
    });

    expect(mocks.readSynaravaStateForCompare).toHaveBeenCalledWith(
      { kind: "catalog" },
      expect.objectContaining({
        adminUsername: "admin",
        checkedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      }),
    );
  });

  it("does not stamp checkedAt for reused recent AUTO", async () => {
    mocks.refreshShopifyState.mockResolvedValue({
      ok: true,
      runId: "r1",
      runStatus: "SUCCEEDED",
      reused: true,
    });

    await runSyncWaterfall({
      scope: { kind: "catalog" },
      requestedBy: "admin",
      trigger: "AUTO",
    });

    expect(mocks.readSynaravaStateForCompare).toHaveBeenCalledWith(
      { kind: "catalog" },
      expect.objectContaining({ checkedAt: undefined }),
    );
  });

  it("does not stamp checkedAt for PARTIAL or FAILED", async () => {
    for (const runStatus of ["PARTIAL", "FAILED"] as const) {
      mocks.refreshShopifyState.mockResolvedValue({
        ok: true,
        runId: "r1",
        runStatus,
        reused: false,
        warning: "something went wrong",
      });

      await runSyncWaterfall({
        scope: { kind: "catalog" },
        requestedBy: "admin",
        trigger: "MANUAL",
      });

      expect(mocks.readSynaravaStateForCompare).toHaveBeenLastCalledWith(
        { kind: "catalog" },
        expect.objectContaining({ checkedAt: undefined }),
      );
    }
  });
});
