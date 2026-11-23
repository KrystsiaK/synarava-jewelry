import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  checkRateLimit: vi.fn(),
  scanAllCompetitors: vi.fn(),
  writeAuditLog: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/admin-session", () => ({
  requireAdminSession: mocks.requireAdminSession,
  getCurrentAdminSession: vi.fn(),
}));

vi.mock("@/lib/auth/rate-limit", () => ({
  checkRateLimit: mocks.checkRateLimit,
}));

vi.mock("@/lib/marketing/competitors/collect", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/marketing/competitors/collect")>();
  return {
    ...actual,
    scanAllCompetitors: mocks.scanAllCompetitors,
  };
});

vi.mock("@/app/admin/actions/shared", () => ({
  writeAuditLog: mocks.writeAuditLog,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

import { scanCompetitorsAction } from "@/app/admin/actions/marketing";

describe("scanCompetitorsAction auth", () => {
  beforeEach(() => {
    mocks.requireAdminSession.mockReset();
    mocks.checkRateLimit.mockReset();
    mocks.scanAllCompetitors.mockReset();
  });

  it("returns unauthorized without admin session", async () => {
    mocks.requireAdminSession.mockRejectedValue(new Error("redirect"));
    await expect(scanCompetitorsAction()).resolves.toMatchObject({
      ok: false,
      code: "unauthorized",
    });
    expect(mocks.scanAllCompetitors).not.toHaveBeenCalled();
  });

  it("rate limits to 3/hour", async () => {
    mocks.requireAdminSession.mockResolvedValue({
      username: "a",
      sessionId: "s",
    });
    mocks.checkRateLimit.mockResolvedValue({
      ok: false,
      error: "Too many attempts",
      retryAfterSeconds: 3600,
    });
    await expect(scanCompetitorsAction()).resolves.toMatchObject({
      ok: false,
      code: "rate_limited",
    });
  });

  it("stores truncated domain errors + sitemapComplete in AuditLog after", async () => {
    mocks.requireAdminSession.mockResolvedValue({
      username: "a",
      sessionId: "s",
    });
    mocks.checkRateLimit.mockResolvedValue({ ok: true });
    mocks.writeAuditLog.mockResolvedValue(undefined);
    mocks.scanAllCompetitors.mockResolvedValue({
      writtenTotal: 0,
      unparsedTotal: 0,
      durationMs: 10,
      truncated: false,
      domains: [
        {
          domain: "parfois.com",
          label: "Parfois",
          fetched: 0,
          written: 0,
          unparsed: 0,
          skippedRobots: 0,
          sitemapComplete: false,
          errors: [
            "HTTP 403 blocked: https://www.parfois.com/pt/pt/bijuteria/x.html",
            "y".repeat(250),
            "third",
            "fourth-dropped",
          ],
        },
      ],
    });

    const result = await scanCompetitorsAction();
    expect(result.ok).toBe(true);
    expect(mocks.writeAuditLog).toHaveBeenCalledOnce();
    const after = mocks.writeAuditLog.mock.calls[0]![0].after as {
      domains: Array<{
        domain: string;
        sitemapComplete: boolean;
        errors: string[];
        skippedRobots: number;
      }>;
    };
    expect(after.domains[0]?.sitemapComplete).toBe(false);
    expect(after.domains[0]?.skippedRobots).toBe(0);
    expect(after.domains[0]?.errors).toHaveLength(3);
    expect(after.domains[0]?.errors[1]?.length).toBe(200);
    expect(after.domains[0]?.errors[1]?.endsWith("…")).toBe(true);
    if (result.ok) {
      expect(result.domains[0]?.firstError).toMatch(/HTTP 403/);
    }
  });
});

