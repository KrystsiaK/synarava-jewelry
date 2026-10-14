/**
 * Fixed-window rate limit for cross-project HTTPS clients.
 * Keyed by workspace + credential fingerprint (Authorization header).
 */
export type RateLimitResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly retryAfterSec: number };

export type RateLimitStore = {
  take(key: string, nowMs: number): RateLimitResult;
};

export function createFixedWindowRateLimiter(options: {
  readonly limitPerMinute: number;
  readonly windowMs?: number;
}): RateLimitStore {
  const windowMs = options.windowMs ?? 60_000;
  const limit = Math.max(1, options.limitPerMinute);
  const buckets = new Map<string, { readonly windowStart: number; count: number }>();

  return {
    take(key, nowMs) {
      const windowStart = nowMs - (nowMs % windowMs);
      const current = buckets.get(key);
      if (!current || current.windowStart !== windowStart) {
        buckets.set(key, { windowStart, count: 1 });
        return { ok: true };
      }
      if (current.count >= limit) {
        const retryAfterSec = Math.max(
          1,
          Math.ceil((current.windowStart + windowMs - nowMs) / 1000),
        );
        return { ok: false, retryAfterSec };
      }
      current.count += 1;
      return { ok: true };
    },
  };
}

export function rateLimitKey(params: {
  readonly workspaceKey: string;
  readonly authorizationHeader: string | undefined;
}): string {
  const auth = params.authorizationHeader?.trim() || "anonymous";
  return `${params.workspaceKey}|${auth}`;
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
