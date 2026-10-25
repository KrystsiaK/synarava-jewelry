import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  executeRaw: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    $executeRaw: mocks.executeRaw,
  },
}));

import {
  cleanupSyncHistory,
  cleanupSyncHistoryBestEffort,
  SYNC_HISTORY_CLEANUP_BATCH_SIZE,
  SYNC_HISTORY_RETENTION_DAYS,
} from "@/lib/shopify/sync-history-retention";

/** $executeRaw`...` arrives as (strings, ...values). */
function sqlFromCall(call: unknown[]): string {
  const strings = call[0] as ArrayLike<string>;
  return Array.from(strings).join("?");
}

function valuesFromCall(call: unknown[]): unknown[] {
  return call.slice(1);
}

function allSql(): string[] {
  return mocks.executeRaw.mock.calls.map((call) => sqlFromCall(call as unknown[]));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.executeRaw.mockResolvedValue(0);
});

describe("cleanupSyncHistory", () => {
  it("defaults to 90-day retention and one batch per table", async () => {
    const now = new Date("2026-10-25T12:00:00.000Z");
    await cleanupSyncHistory({ now });
    expect(SYNC_HISTORY_RETENTION_DAYS).toBe(90);
    expect(SYNC_HISTORY_CLEANUP_BATCH_SIZE).toBe(500);
    expect(mocks.executeRaw).toHaveBeenCalledTimes(5);
  });

  it("deletes only resolved divergences older than cutoff", async () => {
    mocks.executeRaw.mockResolvedValueOnce(3).mockResolvedValue(0);
    const now = new Date("2026-10-25T12:00:00.000Z");
    const stats = await cleanupSyncHistory({ now, maxBatches: 1 });
    expect(stats.divergences).toBe(3);

    const divergenceSql = sqlFromCall(mocks.executeRaw.mock.calls[0] as unknown[]);
    expect(divergenceSql).toContain("ShopifyFieldDivergence");
    expect(divergenceSql).toContain('"resolvedAt" IS NOT NULL');
    expect(divergenceSql).toContain('"resolvedAt" <');
  });

  it("keeps unresolved divergences (never deletes WHERE resolvedAt IS NULL alone)", async () => {
    mocks.executeRaw.mockResolvedValue(0);
    await cleanupSyncHistory({ now: new Date("2026-10-25T12:00:00.000Z") });
    const divergenceSql = sqlFromCall(mocks.executeRaw.mock.calls[0] as unknown[]);
    expect(divergenceSql).toMatch(/"resolvedAt" IS NOT NULL/);
    expect(divergenceSql).not.toMatch(
      /FROM "ShopifyFieldDivergence"\s+WHERE "resolvedAt" IS NULL/,
    );
  });

  it("deletes only finished reconcile runs without open divergences", async () => {
    mocks.executeRaw
      .mockResolvedValueOnce(0) // divergences
      .mockResolvedValueOnce(2) // runs
      .mockResolvedValue(0);
    await cleanupSyncHistory({ now: new Date("2026-10-25T12:00:00.000Z") });
    const runSql = sqlFromCall(mocks.executeRaw.mock.calls[1] as unknown[]);
    expect(runSql).toContain("ShopifyReconcileRun");
    expect(runSql).toContain("SUCCEEDED");
    expect(runSql).toContain("PARTIAL");
    expect(runSql).toContain("FAILED");
    expect(runSql).not.toContain("QUEUED");
    expect(runSql).not.toContain("RUNNING");
    expect(runSql).toContain("NOT EXISTS");
    expect(runSql).toContain('"resolvedAt" IS NULL');
  });

  it("keeps recent rows by comparing createdAt/resolvedAt to cutoff", async () => {
    const now = new Date("2026-10-25T12:00:00.000Z");
    const expectedCutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    await cleanupSyncHistory({ now });
    for (const call of mocks.executeRaw.mock.calls) {
      const values = valuesFromCall(call as unknown[]);
      expect(values[0]).toEqual(expectedCutoff);
    }
  });

  it("batches until empty when maxBatches allows", async () => {
    mocks.executeRaw
      .mockResolvedValueOnce(500)
      .mockResolvedValueOnce(500)
      .mockResolvedValueOnce(12)
      .mockResolvedValue(0);

    const stats = await cleanupSyncHistory({
      now: new Date("2026-10-25T12:00:00.000Z"),
      maxBatches: 10,
      batchSize: 500,
    });
    expect(stats.divergences).toBe(1012);
    expect(mocks.executeRaw).toHaveBeenCalledTimes(7);
  });

  it("stops a table drain when a batch returns 0 before maxBatches", async () => {
    mocks.executeRaw.mockResolvedValue(0);
    await cleanupSyncHistory({ maxBatches: 50 });
    expect(mocks.executeRaw).toHaveBeenCalledTimes(5);
  });

  it("ages ProductSyncEvent, TranslationSyncEvent, ShopifyWebhookDelivery by createdAt", async () => {
    mocks.executeRaw.mockResolvedValue(0);
    await cleanupSyncHistory({ now: new Date("2026-10-25T12:00:00.000Z") });
    const sql = allSql().join("\n");
    expect(sql).toContain("ProductSyncEvent");
    expect(sql).toContain("TranslationSyncEvent");
    expect(sql).toContain("ShopifyWebhookDelivery");
    expect(sql).toMatch(/"createdAt" </);
  });
});

describe("cleanupSyncHistoryBestEffort", () => {
  it("swallows errors so the admin check path stays green", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.executeRaw.mockRejectedValue(new Error("db down"));
    await expect(cleanupSyncHistoryBestEffort()).resolves.toBeUndefined();
    errorSpy.mockRestore();
  });
});
