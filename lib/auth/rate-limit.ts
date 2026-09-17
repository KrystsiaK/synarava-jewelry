import { createHash } from "node:crypto";

import { db } from "@/lib/db";

const _rl = new Map<string, { count: number; resetAt: number }>();
const MAX_FALLBACK_BUCKETS = 10_000;
let lastDatabaseCleanupAt = 0;

function hashRateLimitKey(action: string, identifier: string) {
  return createHash("sha256").update(`${action}:${identifier}`).digest("hex");
}

function checkFallbackRateLimit(
  key: string,
  opts: { max: number; windowMs: number },
): { ok: true } | { ok: false; error: string; retryAfterSeconds: number } {
  const now = Date.now();
  for (const [candidate, value] of _rl) {
    if (value.resetAt <= now) _rl.delete(candidate);
  }
  while (_rl.size >= MAX_FALLBACK_BUCKETS) {
    const oldest = _rl.keys().next().value;
    if (!oldest) break;
    _rl.delete(oldest);
  }

  const entry = _rl.get(key);
  if (!entry || entry.resetAt <= now) {
    _rl.set(key, { count: 1, resetAt: now + opts.windowMs });
    return { ok: true };
  }
  if (entry.count >= opts.max) {
    const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000);
    return { ok: false, error: `Too many attempts. Try again in ${retryAfterSeconds}s.`, retryAfterSeconds };
  }
  entry.count += 1;
  return { ok: true };
}

// A read-then-write inside a (default READ COMMITTED) transaction doesn't
// serialize two concurrent requests: both can read the same pre-increment
// count and both decide "ok", letting the true count exceed `max` (REV-18).
// This is one atomic INSERT .. ON CONFLICT .. DO UPDATE statement instead —
// Postgres row-locks the conflicting row for the duration of the statement,
// so concurrent callers are serialized by the database itself. The WHERE
// clause on the DO UPDATE both decides whether this call is allowed (an
// expired bucket resets to 1; a live one increments only while under `max`)
// and, via RETURNING, reports back whether it actually happened — a skipped
// update (already at cap) returns zero rows.
async function atomicCheckAndIncrement(key: string, now: number, opts: { max: number; windowMs: number }) {
  const resetAt = new Date(now + opts.windowMs);
  const nowDate = new Date(now);
  const rows = await db.$queryRaw<Array<{ resetAt: Date }>>`
    INSERT INTO "RateLimitBucket" ("keyHash", "count", "resetAt", "updatedAt")
    VALUES (${key}, 1, ${resetAt}, NOW())
    ON CONFLICT ("keyHash") DO UPDATE
    SET
      "count" = CASE WHEN "RateLimitBucket"."resetAt" <= ${nowDate} THEN 1 ELSE "RateLimitBucket"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimitBucket"."resetAt" <= ${nowDate} THEN ${resetAt} ELSE "RateLimitBucket"."resetAt" END,
      "updatedAt" = NOW()
    WHERE "RateLimitBucket"."resetAt" <= ${nowDate} OR "RateLimitBucket"."count" < ${opts.max}
    RETURNING "resetAt"
  `;
  if (rows.length > 0) return { limited: false as const };

  // Skipped: the bucket exists, hasn't expired, and is already at cap.
  const existing = await db.rateLimitBucket.findUnique({ where: { keyHash: key } });
  const retryAfterSeconds = Math.max(1, Math.ceil(((existing?.resetAt.getTime() ?? resetAt.getTime()) - now) / 1000));
  return { limited: true as const, retryAfterSeconds };
}

export async function checkRateLimit(
  action: string,
  identifier: string,
  opts: { max: number; windowMs: number },
): Promise<{ ok: true } | { ok: false; error: string; retryAfterSeconds: number }> {
  const key = hashRateLimitKey(action, identifier);
  const now = Date.now();
  try {
    if (now - lastDatabaseCleanupAt > 10 * 60 * 1000) {
      lastDatabaseCleanupAt = now;
      await db.rateLimitBucket.deleteMany({ where: { resetAt: { lte: new Date(now) } } });
    }
    const result = await atomicCheckAndIncrement(key, now, opts);
    if (result.limited) {
      return { ok: false, error: `Too many attempts. Try again in ${result.retryAfterSeconds}s.`, retryAfterSeconds: result.retryAfterSeconds };
    }
    return { ok: true };
  } catch {
    // A bounded local fallback keeps protection in place during a transient DB outage.
    return checkFallbackRateLimit(key, opts);
  }
}

export async function clearRateLimit(action: string, identifier: string) {
  const key = hashRateLimitKey(action, identifier);
  _rl.delete(key);
  try {
    await db.rateLimitBucket.deleteMany({ where: { keyHash: key } });
  } catch {
    // Login/logout should still complete when the limiter store is unavailable.
  }
}

