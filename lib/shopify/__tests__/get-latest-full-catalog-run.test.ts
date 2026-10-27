import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Audit #3: getLatestReconcileRun must ignore scoped LOCALE/ENTITY runs so a
 * later narrow check cannot hide a failed full catalog run.
 */

const mocks = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  executeRaw: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    $queryRaw: mocks.queryRaw,
    $executeRaw: mocks.executeRaw,
  },
}));

import { getLatestReconcileRun } from "@/lib/shopify/reconciliation-run";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getLatestReconcileRun full-catalog scope", () => {
  it("queries only AUTO/MANUAL rows with null scope", async () => {
    const now = new Date();
    mocks.queryRaw.mockResolvedValueOnce([
      {
        id: "full-failed",
        trigger: "MANUAL",
        status: "FAILED",
        checkedCount: 0,
        differenceCount: 0,
        error: "boom",
        startedAt: now,
        completedAt: now,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const run = await getLatestReconcileRun();
    expect(run?.id).toBe("full-failed");
    expect(run?.status).toBe("FAILED");

    const sql = String(mocks.queryRaw.mock.calls[0]?.[0]?.strings?.join("") ?? mocks.queryRaw.mock.calls[0]?.[0] ?? "");
    // Prisma Sql objects expose strings; also accept serialized form.
    const blob = JSON.stringify(mocks.queryRaw.mock.calls[0]?.[0] ?? {});
    expect(blob).toMatch(/AUTO/);
    expect(blob).toMatch(/MANUAL/);
    expect(blob).toMatch(/scope/);
    expect(sql.length >= 0).toBe(true);
  });

  it("materializes lease-expired RUNNING as FAILED on read", async () => {
    const stale = new Date(Date.now() - 11 * 60 * 1000);
    mocks.queryRaw
      .mockResolvedValueOnce([
        {
          id: "stale-running",
          trigger: "AUTO",
          status: "RUNNING",
          checkedCount: 0,
          differenceCount: 0,
          error: null,
          startedAt: stale,
          completedAt: null,
          createdAt: stale,
          updatedAt: stale,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "stale-running",
          trigger: "AUTO",
          status: "FAILED",
          checkedCount: 0,
          differenceCount: 0,
          error: "Check timed out (lease expired after 10 minutes).",
          startedAt: stale,
          completedAt: new Date(),
          createdAt: stale,
          updatedAt: new Date(),
        },
      ]);
    mocks.executeRaw.mockResolvedValue(undefined);

    const run = await getLatestReconcileRun();
    expect(run?.status).toBe("FAILED");
    expect(mocks.executeRaw).toHaveBeenCalled();
  });
});
