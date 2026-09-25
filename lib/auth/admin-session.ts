import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  ADMIN_RETURN_TO_COOKIE,
  ADMIN_RETURN_TO_MAX_AGE_SECONDS,
  REQUEST_PATHNAME_HEADER,
  REQUEST_SEARCH_HEADER,
  adminReturnCookieOptions,
  getSafeAdminRedirect,
} from "@/lib/auth/admin-return-path";
import { verifyPassword } from "@/lib/auth/password";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

export {
  ADMIN_RETURN_TO_COOKIE,
  getSafeAdminRedirect,
} from "@/lib/auth/admin-return-path";

export const ADMIN_SESSION_COOKIE = "synarava-admin-session";
const ADMIN_SESSION_MAX_AGE = 60 * 60 * 8;

export type AdminSession = {
  username: string;
  id: null;
  sessionId: string;
};

function getAdminSessionSecret(): string {
  const secret = env.ADMIN_SESSION_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("ADMIN_SESSION_SECRET must be set in production.");
    }
    return "synarava-dev-admin-secret-do-not-use-in-production";
  }
  return secret;
}

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function signAdminValue(value: string): string {
  return createHmac("sha256", getAdminSessionSecret()).update(value).digest("hex");
}

/** Compares two strings in constant time (via their digests, so length itself never leaks) to resist timing attacks on credential/token comparisons. */
function constantTimeEqual(a: string, b: string) {
  return timingSafeEqual(Buffer.from(digest(a), "hex"), Buffer.from(digest(b), "hex"));
}

/**
 * The admin session cookie is `sessionId.token.signature`:
 * - `sessionId` looks up the `AdminSession` row (holds only `tokenHash`,
 *   never the raw token).
 * - `token` is the session secret; only its SHA-256 digest is ever stored,
 *   so a database read alone can't produce a valid cookie.
 * - `signature` is an HMAC (server-secret-keyed) over `sessionId.token`,
 *   so a client can't forge a cookie for a `sessionId` it doesn't already
 *   hold the token for, even if it could guess or enumerate session ids.
 *
 * All three checks must pass before the caller even queries the database
 * for the session row.
 */
function parseAdminCookie(raw: string) {
  const [sessionId, token, signature, ...rest] = raw.split(".");
  if (rest.length || !sessionId || !token || !signature) return null;
  if (!/^[0-9a-f]{64}$/i.test(token) || !/^[0-9a-f]{64}$/i.test(signature)) return null;

  const payload = `${sessionId}.${token}`;
  if (!constantTimeEqual(signature, signAdminValue(payload))) return null;
  return { sessionId, token };
}

/** Lightweight signature validation for an edge request guard. */
export function hasValidAdminSessionCookie(raw: string | undefined) {
  return Boolean(raw && parseAdminCookie(raw));
}

/**
 * `ADMIN_PASSWORD` (a plaintext env var) only works outside production —
 * it exists purely so local development doesn't require generating a
 * password hash first. Production must set `ADMIN_PASSWORD_HASH`.
 */
function getAdminCredentials() {
  const username = env.ADMIN_USERNAME?.trim() || env.ADMIN_EMAIL?.trim() || "";
  const legacyPassword = process.env.NODE_ENV === "production" ? "" : env.ADMIN_PASSWORD?.trim() || "";
  return {
    username,
    passwordHash: env.ADMIN_PASSWORD_HASH?.trim() ?? "",
    legacyPassword,
  };
}

export function isAdminAuthConfigured() {
  const credentials = getAdminCredentials();
  return Boolean(
    credentials.username &&
      (credentials.passwordHash || (process.env.NODE_ENV !== "production" && credentials.legacyPassword)),
  );
}

export function verifyAdminCredentials(username: string, password: string) {
  const credentials = getAdminCredentials();
  const usernameMatches = constantTimeEqual(username.trim(), credentials.username || "missing-admin");
  const passwordMatches = credentials.passwordHash
    ? verifyPassword(password, credentials.passwordHash)
    : process.env.NODE_ENV !== "production" &&
      credentials.legacyPassword.length > 0 &&
      constantTimeEqual(password, credentials.legacyPassword);

  return Boolean(credentials.username && usernameMatches && passwordMatches);
}

export async function createAdminSession(metadata?: { ipAddress?: string; userAgent?: string }) {
  const credentials = getAdminCredentials();
  if (!credentials.username) {
    throw new Error("ADMIN_USERNAME must be set before creating an admin session.");
  }

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + ADMIN_SESSION_MAX_AGE * 1000);
  await db.adminSession.deleteMany({ where: { expiresAt: { lte: new Date() } } });
  const session = await db.adminSession.create({
    data: {
      tokenHash: digest(token),
      username: credentials.username,
      ipAddress: metadata?.ipAddress?.slice(0, 64) || null,
      userAgent: metadata?.userAgent?.slice(0, 512) || null,
      expiresAt,
    },
    select: { id: true },
  });
  const payload = `${session.id}.${token}`;

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, `${payload}.${signAdminValue(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/admin",
    maxAge: ADMIN_SESSION_MAX_AGE,
    expires: expiresAt,
  });
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  const parsed = parseAdminCookie(cookieStore.get(ADMIN_SESSION_COOKIE)?.value ?? "");
  if (parsed) await db.adminSession.deleteMany({ where: { id: parsed.sessionId } });

  cookieStore.set(ADMIN_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/admin",
    maxAge: 0,
    expires: new Date(0),
  });
}

export async function getCurrentAdminSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies();
  const parsed = parseAdminCookie(cookieStore.get(ADMIN_SESSION_COOKIE)?.value ?? "");
  if (!parsed) return null;

  const session = await db.adminSession.findUnique({ where: { id: parsed.sessionId } });
  if (!session || !constantTimeEqual(session.tokenHash, digest(parsed.token))) return null;

  if (session.expiresAt.getTime() <= Date.now()) {
    await db.adminSession.deleteMany({ where: { id: session.id } });
    return null;
  }

  const credentials = getAdminCredentials();
  if (!credentials.username || !constantTimeEqual(session.username, credentials.username)) return null;

  if (Date.now() - session.lastSeenAt.getTime() > 5 * 60 * 1000) {
    await db.adminSession.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });
  }

  return { username: session.username, id: null, sessionId: session.id };
}

/**
 * Resolves the page the user was trying to open. Prefer an explicit argument
 * (Server Actions pass a section root); otherwise use the path injected by
 * `proxy.ts`. Falls back to `/admin` when neither is available.
 */
async function resolveAdminLoginRedirect(redirectTo?: string) {
  if (redirectTo) return getSafeAdminRedirect(redirectTo);

  const h = await headers();
  const pathname = h.get(REQUEST_PATHNAME_HEADER) ?? "";
  const search = h.get(REQUEST_SEARCH_HEADER) ?? "";
  return getSafeAdminRedirect(pathname ? `${pathname}${search}` : undefined);
}

async function rememberAdminReturnPath(target: string) {
  const cookieStore = await cookies();
  cookieStore.set(
    ADMIN_RETURN_TO_COOKIE,
    target,
    adminReturnCookieOptions(ADMIN_RETURN_TO_MAX_AGE_SECONDS),
  );
}

export async function clearAdminReturnPath() {
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_RETURN_TO_COOKIE, "", adminReturnCookieOptions(0));
}

export async function readAdminReturnPath(): Promise<string | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(ADMIN_RETURN_TO_COOKIE)?.value;
  if (!raw) return null;
  return getSafeAdminRedirect(raw);
}

export async function requireAdminSession(redirectTo?: string) {
  const session = await getCurrentAdminSession();
  if (!session) {
    const target = await resolveAdminLoginRedirect(redirectTo);
    await rememberAdminReturnPath(target);
    redirect(`/admin/login?redirectTo=${encodeURIComponent(target)}`);
  }
  return session;
}
