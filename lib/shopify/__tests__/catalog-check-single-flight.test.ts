import { beforeEach, describe, expect, it, vi } from "vitest";

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

describe("catalog check single-flight + lease", () => {
  it("refuses a second start while a fresh run is RUNNING", async () => {
    const active = runRow({ id: "active-run" });
    mocks.executeRaw.mockResolvedValue(undefined); // advisory lock
    mocks.queryRaw
      .mockResolvedValueOnce([{
        id: active.id,
        startedAt: active.startedAt,
        createdAt: active.createdAt,
        updatedAt: active.updatedAt,
      }])
      .mockResolvedValueOnce([active]); // runById

    await expect(beginCatalogCheckRun({ trigger: "MANUAL", requestedBy: "admin" })).resolves.toMatchObject({
      status: "already_running",
      run: { id: "active-run", status: "RUNNING" },
    });
  });

  it("treats a RUNNING run older than the 10-minute lease as dead and starts a new one", async () => {
    const staleStarted = new Date(Date.now() - CATALOG_CHECK_LEASE_MS - 60_000);
    const stale = {
      id: "stale-run",
      startedAt: staleStarted,
      createdAt: staleStarted,
      updatedAt: staleStarted,
    };
    const fresh = runRow({ id: "fresh-run", status: "RUNNING" });
    mocks.executeRaw.mockResolvedValue(undefined);
    mocks.queryRaw
      .mockResolvedValueOnce([stale]) // active lookup
      .mockResolvedValueOnce([fresh]); // runById after insert

    await expect(beginCatalogCheckRun({ trigger: "MANUAL", requestedBy: "admin" })).resolves.toMatchObject({
      status: "started",
      run: { id: "fresh-run" },
    });

    const failStale = mocks.executeRaw.mock.calls.find(
      ([query]) =>
        typeof query === "object"
        && query !== null
        && "values" in query
        && Array.isArray((query as { values: unknown[] }).values)
        && (query as { values: unknown[] }).values.includes("stale-run"),
    );
    expect(failStale).toBeTruthy();
  });
});
