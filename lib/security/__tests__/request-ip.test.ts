import { afterEach, describe, expect, it } from "vitest";

import { getTrustedClientIp } from "@/lib/security/request-ip";

function headers(values: Record<string, string>) {
  return { get: (name: string) => values[name] ?? null };
}

describe("getTrustedClientIp", () => {
  afterEach(() => {
    delete process.env.TRUSTED_PROXY_HOPS;
  });

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

  it("honors TRUSTED_PROXY_HOPS when a CDN sits in front", () => {
    process.env.TRUSTED_PROXY_HOPS = "2";
    expect(
      getTrustedClientIp(headers({
        "x-forwarded-for": "198.51.100.5, 203.0.113.10, 192.0.2.1",
      })),
    ).toBe("203.0.113.10");
  });
});
