import { describe, expect, it } from "vitest";
import { safeHttpFailureReason } from "@/lib/mission-control/analytics/http-reason";

describe("safeHttpFailureReason", () => {
  it.each([
    [401, /http_401/],
    [403, /http_403/],
    [429, /http_429/],
    [500, /http_5xx/],
    [503, /http_5xx/],
  ])("status %s → class", (status, klass) => {
    const reason = safeHttpFailureReason({ status });
    expect(reason).toContain(String(status));
    expect(reason).toMatch(klass);
    expect(reason).not.toMatch(/Bearer|token|eyJ|BEGIN PRIVATE/i);
  });

  it("timeout class has no body/token", () => {
    const reason = safeHttpFailureReason(
      new DOMException("The operation was aborted", "TimeoutError"),
    );
    expect(reason.toLowerCase()).toMatch(/timeout/);
    expect(reason).not.toMatch(/Bearer|password|Authorization/i);
  });

  it("never echoes response bodies", () => {
    const reason = safeHttpFailureReason({
      status: 401,
      body: '{"error":"invalid_token","access_token":"secret"}',
    });
    expect(reason).not.toContain("invalid_token");
    expect(reason).not.toContain("secret");
    expect(reason).toMatch(/401/);
  });
});
