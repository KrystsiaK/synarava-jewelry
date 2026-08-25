import { getTrustedClientIp } from "@/lib/security/request-ip";

function headers(values: Record<string, string>) {
  return { get: (name: string) => values[name] ?? null };
}

describe("getTrustedClientIp", () => {
  it("does not trust the attacker-controlled leftmost forwarded address", () => {
    expect(getTrustedClientIp(headers({ "x-forwarded-for": "198.51.100.5, 203.0.113.10" })))
      .toBe("203.0.113.10");
  });

  it("prefers a platform-provided client address", () => {
    expect(getTrustedClientIp(headers({
      "cf-connecting-ip": "2001:db8::1",
      "x-forwarded-for": "198.51.100.5, 203.0.113.10",
    }))).toBe("2001:db8::1");
  });

  it("rejects malformed header values", () => {
    expect(getTrustedClientIp(headers({ "x-forwarded-for": "not-an-ip" }))).toBe("unknown");
  });
});
