import { createHash } from "node:crypto";
import type { IncomingMessage } from "node:http";
import type { WorkspaceCredential } from "../auth.js";

/**
 * Fixed-window rate limit for cross-project HTTPS clients.
 *
 * - Pre-auth: shared per workspace + client IP (blocks random-Bearer scrypt burn).
 * - Post-auth: per workspace + credential fingerprint (never raw Bearer).
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

/**
 * Client IP for pre-auth buckets on Railway.
 * Trust only `X-Real-IP` (edge-set). Ignore client-controlled `X-Forwarded-For`.
 * https://docs.railway.com/reference/public-networking (proxy headers)
 */
export function clientIpFromRequest(req: IncomingMessage): string {
  const realIp = req.headers["x-real-ip"];
  if (typeof realIp === "string" && realIp.trim() !== "") {
    return realIp.trim();
  }
  if (Array.isArray(realIp)) {
    const first = realIp.find((v) => typeof v === "string" && v.trim() !== "");
    if (first) return first.trim();
  }
  // Do not read x-forwarded-for — spoofable by clients.
  return req.socket.remoteAddress ?? "unknown";
}

/** Pre-auth key: workspace + IP — shared across random Bearer attempts. */
export function preAuthRateLimitKey(params: {
  readonly workspaceKey: string;
  readonly clientIp: string;
}): string {
  return `pre|${params.workspaceKey}|${params.clientIp}`;
}

/**
 * Fingerprint of a stored credential (salt+hash), never the raw Bearer token.
 */
export function fingerprintCredential(
  credential: WorkspaceCredential,
): string {
  return createHash("sha256")
    .update(
      `${credential.workspaceKey}:${credential.salt}:${credential.tokenHash}`,
    )
    .digest("hex")
    .slice(0, 32);
}

/** Post-auth key: workspace + credential fingerprint. */
export function postAuthRateLimitKey(params: {
  readonly workspaceKey: string;
  readonly credential: WorkspaceCredential;
}): string {
  return `post|${params.workspaceKey}|${fingerprintCredential(params.credential)}`;
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
