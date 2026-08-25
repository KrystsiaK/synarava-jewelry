import { redirect } from "next/navigation";
import { createHash } from "node:crypto";

import { getCurrentSession } from "@/lib/auth/session";
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
    const result = await db.$transaction(async (tx) => {
      const existing = await tx.rateLimitBucket.findUnique({ where: { keyHash: key } });
      if (!existing || existing.resetAt.getTime() <= now) {
        const bucket = await tx.rateLimitBucket.upsert({
          where: { keyHash: key },
          create: { keyHash: key, count: 1, resetAt: new Date(now + opts.windowMs) },
          update: { count: 1, resetAt: new Date(now + opts.windowMs) },
        });
        return { bucket, limited: false };
      }
      if (existing.count >= opts.max) return { bucket: existing, limited: true };
      const bucket = await tx.rateLimitBucket.update({
        where: { keyHash: key },
        data: { count: { increment: 1 } },
      });
      return { bucket, limited: false };
    });

    if (result.limited) {
      const retryAfterSeconds = Math.max(1, Math.ceil((result.bucket.resetAt.getTime() - now) / 1000));
      return { ok: false, error: `Too many attempts. Try again in ${retryAfterSeconds}s.`, retryAfterSeconds };
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

export class AuthorizationError extends Error {
  readonly status = 403;
  constructor(message = "Access denied") {
    super(message);
    this.name = "AuthorizationError";
  }
}

export async function requireAuthenticatedUser() {
  const session = await getCurrentSession();

  if (!session?.user) {
    redirect("/login?redirectTo=/profile");
  }

  if (session.user.status === "SUSPENDED") {
    redirect("/login?error=suspended");
  }

  return session.user;
}

// Verifies the given userId equals the current session's user id.
// Never accept a userId from client-provided params — always resolve from session first.
export async function assertOwnership(resourceUserId: string | null | undefined) {
  const session = await getCurrentSession();

  if (!session?.user) {
    throw new AuthorizationError("Not authenticated");
  }

  if (!resourceUserId || resourceUserId !== session.user.id) {
    throw new AuthorizationError("Resource does not belong to current user");
  }

  return session.user;
}

export async function assertOrderOwnership(orderId: string) {
  const session = await getCurrentSession();
  if (!session?.user) throw new AuthorizationError("Not authenticated");

  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { userId: true },
  });

  if (!order || order.userId !== session.user.id) {
    throw new AuthorizationError("Order not found");
  }

  return session.user;
}

export async function assertAddressOwnership(addressId: string) {
  const session = await getCurrentSession();
  if (!session?.user) throw new AuthorizationError("Not authenticated");

  const address = await db.address.findUnique({
    where: { id: addressId },
    select: {
      customerProfile: { select: { userId: true } },
    },
  });

  if (!address?.customerProfile || address.customerProfile.userId !== session.user.id) {
    throw new AuthorizationError("Address not found");
  }

  return session.user;
}

export async function assertPermission(permissionKey: string) {
  const session = await getCurrentSession();
  if (!session?.user) throw new AuthorizationError("Not authenticated");

  const has = session.user.roles.some((ur) =>
    ur.role.permissions.some((rp) => rp.permission.key === permissionKey),
  );

  if (!has) throw new AuthorizationError(`Missing permission: ${permissionKey}`);

  return session.user;
}
