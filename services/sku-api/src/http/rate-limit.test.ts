import { describe, expect, it } from "vitest";
import {
  createFixedWindowRateLimiter,
  fingerprintAuthorization,
  rateLimitKey,
  resolveRateLimitPerMinute,
} from "./rate-limit.js";

describe("sku-api rate limit", () => {
  it("allows up to limit then rejects within the window", () => {
    const limiter = createFixedWindowRateLimiter({
      limitPerMinute: 2,
      windowMs: 60_000,
    });
    const key = rateLimitKey({
      workspaceKey: "synarava-shop",
      authorizationHeader: "Bearer t",
    });
    expect(limiter.take(key, 1_000).ok).toBe(true);
    expect(limiter.take(key, 1_001).ok).toBe(true);
    const blocked = limiter.take(key, 1_002);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("resets on the next window", () => {
    const limiter = createFixedWindowRateLimiter({
      limitPerMinute: 1,
      windowMs: 1_000,
    });
    const key = rateLimitKey({
      workspaceKey: "w",
      authorizationHeader: "Bearer x",
    });
    expect(limiter.take(key, 500).ok).toBe(true);
    expect(limiter.take(key, 600).ok).toBe(false);
    expect(limiter.take(key, 1_500).ok).toBe(true);
  });

  it("never embeds the raw Bearer token in the key", () => {
    const secret = "super-secret-token-value";
    const key = rateLimitKey({
      workspaceKey: "synarava-shop",
      authorizationHeader: `Bearer ${secret}`,
    });
    expect(key.includes(secret)).toBe(false);
    expect(key.includes("Bearer")).toBe(false);
    expect(key.startsWith("synarava-shop|")).toBe(true);
    expect(key.split("|")[1]).toBe(
      fingerprintAuthorization(`Bearer ${secret}`),
    );
  });

  it("bounds stored keys by evicting oldest windows", () => {
    const limiter = createFixedWindowRateLimiter({
      limitPerMinute: 10,
      windowMs: 60_000,
      maxKeys: 2,
    });
    expect(limiter.take("a|1", 1_000).ok).toBe(true);
    expect(limiter.take("b|1", 2_000).ok).toBe(true);
    expect(limiter.take("c|1", 3_000).ok).toBe(true);
    // Oldest key `a` was evicted; a new take for `a` starts a fresh window.
    expect(limiter.take("a|1", 3_100).ok).toBe(true);
  });

  it("parses env with fallback", () => {
    expect(resolveRateLimitPerMinute(undefined)).toBe(120);
    expect(resolveRateLimitPerMinute("60")).toBe(60);
    expect(resolveRateLimitPerMinute("nope")).toBe(120);
  });
});
