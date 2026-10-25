import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Audit #5: finishRun must only close QUEUED/RUNNING rows; lease uses updatedAt;
 * heartbeat bumps updatedAt.
 */

const mocks = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  executeRaw: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    $queryRaw: mocks.queryRaw,
    $executeRaw: mocks.executeRaw,
    $transaction: mocks.transaction,
  },
}));

import {
  beginCatalogCheckRun,
  CATALOG_CHECK_LEASE_MS,
  finishCatalogCheckRun,
  heartbeatCatalogCheckRun,
  isReconcileRunActivelyChecking,
} from "@/lib/shopify/reconciliation-run";

function runRow(overrides: Partial<Record<string, unknown>> = {}) {
  const now = new Date();
  return {
    id: "run-1",
    trigger: "MANUAL",
    status: "RUNNING",
    checkedCount: 0,
    differenceCount: 0,
    error: null,
    startedAt: now,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.transaction.mockImplementation(async (arg: unknown) =>
    typeof arg === "function"
      ? (arg as (tx: unknown) => unknown)({ $queryRaw: mocks.queryRaw, $executeRaw: mocks.executeRaw })
      : Promise.all(arg as Promise<unknown>[]),
  );
});

describe("finishCatalogCheckRun status guard", () => {
  it("updates only when status is still QUEUED or RUNNING", async () => {
    mocks.executeRaw.mockResolvedValue(undefined);
    mocks.queryRaw.mockResolvedValueOnce([runRow({ status: "SUCCEEDED" })]);

    await finishCatalogCheckRun("run-1", {
      status: "SUCCEEDED",
      checkedCount: 1,
      differenceCount: 0,
    });

    const updateCall = mocks.executeRaw.mock.calls[0]?.[0];
    const blob = JSON.stringify(updateCall ?? {});
    expect(blob).toMatch(/QUEUED/);
    expect(blob).toMatch(/RUNNING/);
  });
});

describe("heartbeat and lease by updatedAt", () => {
  it("heartbeatCatalogCheckRun bumps updatedAt for active rows", async () => {
    mocks.executeRaw.mockResolvedValue(undefined);
    await heartbeatCatalogCheckRun("run-1");
    const blob = JSON.stringify(mocks.executeRaw.mock.calls[0]?.[0] ?? {});
    expect(blob).toMatch(/updatedAt/);
    expect(blob).toMatch(/QUEUED/);
  });

  it("isReconcileRunActivelyChecking is false when updatedAt is past the lease", () => {
    const stale = new Date(Date.now() - CATALOG_CHECK_LEASE_MS - 1000).toISOString();
    expect(isReconcileRunActivelyChecking({
      id: "r",
      trigger: "MANUAL",
      status: "RUNNING",
      checkedCount: 0,
      differenceCount: 0,
      error: null,
      startedAt: stale,
      completedAt: null,
      createdAt: stale,
      updatedAt: stale,
    })).toBe(false);
  });

  it("treats a RUNNING run with fresh updatedAt (heartbeat) as still active even if startedAt is old", async () => {
    const oldStart = new Date(Date.now() - CATALOG_CHECK_LEASE_MS - 60_000);
    const freshBeat = new Date();
    const active = {
      id: "active-run",
      startedAt: oldStart,
      createdAt: oldStart,
      updatedAt: freshBeat,
    };
    mocks.executeRaw.mockResolvedValue(undefined);
    mocks.queryRaw
      .mockResolvedValueOnce([active])
      .mockResolvedValueOnce([runRow({ id: "active-run" })]);

    await expect(beginCatalogCheckRun({ trigger: "MANUAL", requestedBy: "admin" })).resolves.toMatchObject({
      status: "already_running",
      run: { id: "active-run" },
    });
  });
});
