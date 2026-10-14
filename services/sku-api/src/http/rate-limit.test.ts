import { describe, expect, it } from "vitest";
import { createCredential } from "../auth.js";
import {
  createFixedWindowRateLimiter,
  fingerprintCredential,
  postAuthRateLimitKey,
  preAuthRateLimitKey,
  resolveRateLimitPerMinute,
} from "./rate-limit.js";

describe("sku-api rate limit", () => {
  it("pre-auth keys are shared for a workspace+IP (not per Bearer)", () => {
    const a = preAuthRateLimitKey({
      workspaceKey: "synarava-shop",
      clientIp: "1.2.3.4",
    });
    const b = preAuthRateLimitKey({
      workspaceKey: "synarava-shop",
      clientIp: "1.2.3.4",
    });
    expect(a).toBe(b);
    expect(a).toBe("pre|synarava-shop|1.2.3.4");
    expect(a.includes("Bearer")).toBe(false);
  });

  it("pre-auth shared bucket blocks rotating random tokens before scrypt", () => {
    const limiter = createFixedWindowRateLimiter({
      limitPerMinute: 1,
      windowMs: 60_000,
    });
    const key = preAuthRateLimitKey({
      workspaceKey: "synarava-shop",
      clientIp: "9.9.9.9",
    });
    expect(limiter.take(key, 1_000).ok).toBe(true);
    expect(limiter.take(key, 1_001).ok).toBe(false);
  });

  it("post-auth keys use credential fingerprint, never raw Bearer", () => {
    const credential = createCredential("synarava-shop", "super-secret-token");
    const key = postAuthRateLimitKey({
      workspaceKey: "synarava-shop",
      credential,
    });
    expect(key.includes("super-secret-token")).toBe(false);
    expect(key.includes("Bearer")).toBe(false);
    expect(key).toBe(
      `post|synarava-shop|${fingerprintCredential(credential)}`,
    );
  });

  it("allows up to limit then rejects within the window", () => {
    const limiter = createFixedWindowRateLimiter({
      limitPerMinute: 2,
      windowMs: 60_000,
    });
    const key = preAuthRateLimitKey({
      workspaceKey: "synarava-shop",
      clientIp: "10.0.0.1",
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
    const key = preAuthRateLimitKey({
      workspaceKey: "w",
      clientIp: "127.0.0.1",
    });
    expect(limiter.take(key, 500).ok).toBe(true);
    expect(limiter.take(key, 600).ok).toBe(false);
    expect(limiter.take(key, 1_500).ok).toBe(true);
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
    expect(limiter.take("a|1", 3_100).ok).toBe(true);
  });

  it("parses env with fallback", () => {
    expect(resolveRateLimitPerMinute(undefined)).toBe(120);
    expect(resolveRateLimitPerMinute(undefined, 60)).toBe(60);
    expect(resolveRateLimitPerMinute("60")).toBe(60);
    expect(resolveRateLimitPerMinute("nope")).toBe(120);
  });
});
