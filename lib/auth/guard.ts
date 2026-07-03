import { redirect } from "next/navigation";

import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

// Module-level rate limit store — persists per Node.js process.
// In serverless each invocation is isolated; for production swap for Redis.
const _rl = new Map<string, { count: number; resetAt: number }>();
let _rlCleanScheduled = false;

function scheduleCleanup() {
  if (_rlCleanScheduled) return;
  _rlCleanScheduled = true;
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of _rl) {
      if (v.resetAt <= now) _rl.delete(k);
    }
  }, 600_000);
}

export function checkRateLimit(
  action: string,
  identifier: string,
  opts: { max: number; windowMs: number },
): { ok: true } | { ok: false; error: string } {
  scheduleCleanup();

  const key = `${action}:${identifier}`;
  const now = Date.now();
  const entry = _rl.get(key);

  if (!entry || entry.resetAt <= now) {
    _rl.set(key, { count: 1, resetAt: now + opts.windowMs });
    return { ok: true };
  }

  if (entry.count >= opts.max) {
    const secs = Math.ceil((entry.resetAt - now) / 1000);
    return { ok: false, error: `Too many attempts. Try again in ${secs}s.` };
  }

  entry.count++;
  return { ok: true };
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
