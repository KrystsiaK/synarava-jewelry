import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  getTrustedClientIp: vi.fn(() => "203.0.113.10"),
}));

vi.mock("@/lib/auth/rate-limit", () => ({
  checkRateLimit: mocks.checkRateLimit,
}));

vi.mock("@/lib/security/request-ip", () => ({
  getTrustedClientIp: mocks.getTrustedClientIp,
}));

import { GET, POST } from "@/app/api/csp-report/route";

describe("POST /api/csp-report", () => {
  beforeEach(() => {
    mocks.checkRateLimit.mockReset();
    mocks.getTrustedClientIp.mockClear();
    mocks.checkRateLimit.mockResolvedValue({ ok: true });
    delete process.env.CSP_REPORT_LOG;
  });

  it("acknowledges a valid report with 204", async () => {
    const response = await POST(
      new Request("https://shop.synarava.com/api/csp-report", {
        method: "POST",
        headers: { "content-type": "application/csp-report" },
        body: JSON.stringify({
          "csp-report": { "violated-directive": "script-src", "blocked-uri": "https://evil.test" },
        }),
      }),
    );

    expect(response.status).toBe(204);
    expect(mocks.checkRateLimit).toHaveBeenCalledWith(
      "csp-report",
      "203.0.113.10",
      expect.objectContaining({ max: 60 }),
    );
  });

  it("returns 429 when the rate limit is exceeded", async () => {
    mocks.checkRateLimit.mockResolvedValue({
      ok: false,
      error: "too many",
      retryAfterSeconds: 12,
    });

    const response = await POST(
      new Request("https://shop.synarava.com/api/csp-report", {
        method: "POST",
        body: "{}",
      }),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("12");
  });

  it("rejects oversized bodies", async () => {
    const response = await POST(
      new Request("https://shop.synarava.com/api/csp-report", {
        method: "POST",
        body: "x".repeat(40_000),
      }),
    );

    expect(response.status).toBe(413);
  });
});

describe("GET /api/csp-report", () => {
  it("stays quiet for probes", async () => {
    const response = await GET();
    expect(response.status).toBe(204);
  });
});
