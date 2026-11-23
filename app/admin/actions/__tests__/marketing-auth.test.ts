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

vi.mock("@/lib/marketing/competitors/collect", () => ({
  scanAllCompetitors: mocks.scanAllCompetitors,
}));

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
});
