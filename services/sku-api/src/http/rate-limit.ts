import { createHash } from "node:crypto";

/**
 * Fixed-window rate limit for cross-project HTTPS clients.
 * Applied before scrypt auth. Keys never store raw Bearer tokens.
 */
export type RateLimitResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly retryAfterSec: number };

export type RateLimitStore = {
  take(key: string, nowMs: number): RateLimitResult;
};

type Bucket = { readonly windowStart: number; count: number };

const DEFAULT_MAX_KEYS = 10_000;

export function createFixedWindowRateLimiter(options: {
  readonly limitPerMinute: number;
  readonly windowMs?: number;
  /** Cap distinct keys retained (evicts oldest windowStart first). */
  readonly maxKeys?: number;
}): RateLimitStore {
  const windowMs = options.windowMs ?? 60_000;
  const limit = Math.max(1, options.limitPerMinute);
  const maxKeys = Math.max(1, options.maxKeys ?? DEFAULT_MAX_KEYS);
  const buckets = new Map<string, Bucket>();

  function evictIfNeeded(): void {
    if (buckets.size <= maxKeys) return;
    const overflow = buckets.size - maxKeys;
    const ordered = [...buckets.entries()].toSorted(
      (a, b) => a[1].windowStart - b[1].windowStart,
    );
    for (let i = 0; i < overflow; i += 1) {
      const key = ordered[i]?.[0];
      if (key !== undefined) buckets.delete(key);
    }
  }

  return {
    take(key, nowMs) {
      const windowStart = nowMs - (nowMs % windowMs);
      const current = buckets.get(key);
      if (!current || current.windowStart !== windowStart) {
        buckets.set(key, { windowStart, count: 1 });
        evictIfNeeded();
        return { ok: true };
      }
      if (current.count >= limit) {
        const retryAfterSec = Math.max(
          1,
          Math.ceil((current.windowStart + windowMs - nowMs) / 1000),
        );
        return { ok: false, retryAfterSec };
      }
      buckets.set(key, {
        windowStart: current.windowStart,
        count: current.count + 1,
      });
      return { ok: true };
    },
  };
}

/** SHA-256 fingerprint of the Authorization header (never store raw Bearer). */
export function fingerprintAuthorization(
  authorizationHeader: string | undefined,
): string {
  const raw = authorizationHeader?.trim() || "anonymous";
  return createHash("sha256").update(raw).digest("hex").slice(0, 32);
}

export function rateLimitKey(params: {
  readonly workspaceKey: string;
  readonly authorizationHeader: string | undefined;
}): string {
  return `${params.workspaceKey}|${fingerprintAuthorization(params.authorizationHeader)}`;
}

export function resolveRateLimitPerMinute(
  envValue: string | undefined,
  fallback = 120,
): number {
  if (envValue === undefined || envValue.trim() === "") return fallback;
  const parsed = Number.parseInt(envValue, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return parsed;
}
