import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  executeRaw: vi.fn(),
  transaction: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    $queryRaw: mocks.queryRaw,
    $executeRaw: mocks.executeRaw,
    $transaction: mocks.transaction,
    shopifyTranslationBinding: { findMany: mocks.findMany },
  },
}));
vi.mock("@/lib/shopify/admin", () => ({ hasShopifyAdminConfig: () => true }));

import { runTranslationReconciliation } from "@/lib/shopify/reconciliation-run";

function runRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "run-1",
    trigger: "MANUAL",
    status: "RUNNING",
    checkedCount: 0,
    differenceCount: 0,
    error: null,
    startedAt: new Date(),
    completedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // createOrReuseRun: no active run, no recent run, then insert + read back the new row.
  mocks.transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn({
    $queryRaw: mocks.queryRaw,
    $executeRaw: mocks.executeRaw,
  }));
  mocks.executeRaw.mockResolvedValueOnce(undefined); // advisory lock (void-returning, must use $executeRaw)
  mocks.queryRaw
    .mockResolvedValueOnce([]) // no active QUEUED/RUNNING run
    .mockResolvedValueOnce([runRow()]); // runById after insert
});

describe("runTranslationReconciliation", () => {
  it("closes the run as FAILED instead of throwing when a step outside the per-binding loop breaks", async () => {
    mocks.findMany.mockRejectedValue(new Error("connection to database lost"));
    mocks.queryRaw.mockResolvedValueOnce([runRow({ status: "FAILED", error: "connection to database lost" })]); // runById after finishRun

    await expect(runTranslationReconciliation({ trigger: "MANUAL" })).resolves.toMatchObject({
      run: { status: "FAILED", error: "connection to database lost" },
      reused: false,
    });

    // advisory lock + insert (createOrReuseRun) + update (finishRun) — the run must be closed out, not left RUNNING.
    expect(mocks.executeRaw).toHaveBeenCalledTimes(3);
  });
});
