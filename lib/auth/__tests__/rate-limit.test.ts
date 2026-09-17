import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  findUnique: vi.fn(),
  deleteMany: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/db", () => ({
  db: {
    $queryRaw: mocks.queryRaw,
    rateLimitBucket: { findUnique: mocks.findUnique, deleteMany: mocks.deleteMany },
  },
}));

import { checkRateLimit } from "../rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => vi.clearAllMocks());

  it("allows the request when the atomic increment reports success", async () => {
    mocks.queryRaw.mockResolvedValue([{ resetAt: new Date(Date.now() + 60_000) }]);

    await expect(checkRateLimit("action", "1.2.3.4", { max: 30, windowMs: 60_000 })).resolves.toEqual({ ok: true });
  });

  it("rejects the request when the atomic increment is skipped (already at cap)", async () => {
    mocks.queryRaw.mockResolvedValue([]);
    mocks.findUnique.mockResolvedValue({ resetAt: new Date(Date.now() + 12_000) });

    const result = await checkRateLimit("action", "1.2.3.4", { max: 30, windowMs: 60_000 });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("does a single atomic INSERT .. ON CONFLICT statement instead of a separate read then write (REV-18)", async () => {
    mocks.queryRaw.mockResolvedValue([{ resetAt: new Date(Date.now() + 60_000) }]);

    await checkRateLimit("action", "1.2.3.4", { max: 30, windowMs: 60_000 });

    expect(mocks.queryRaw).toHaveBeenCalledTimes(1);
    const [sql] = mocks.queryRaw.mock.calls[0] as [TemplateStringsArray];
    const text = sql.join("");
    expect(text).toContain("ON CONFLICT");
    expect(text).toContain('"count" <');
  });

  it("falls back to the in-memory limiter when the database is unavailable", async () => {
    mocks.queryRaw.mockRejectedValue(new Error("connection refused"));

    const action = `fallback-${Date.now()}`;
    const results = [];
    for (let i = 0; i < 3; i++) {
      results.push(await checkRateLimit(action, "1.2.3.4", { max: 2, windowMs: 60_000 }));
    }

    expect(results.map((result) => result.ok)).toEqual([true, true, false]);
  });
});
