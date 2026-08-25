import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { verifyPassword } from "@/lib/auth/password";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

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

function constantTimeEqual(a: string, b: string) {
  return timingSafeEqual(Buffer.from(digest(a), "hex"), Buffer.from(digest(b), "hex"));
}

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

export async function requireAdminSession(redirectTo = "/admin") {
  const session = await getCurrentAdminSession();
  if (!session) redirect(`/admin/login?redirectTo=${encodeURIComponent(redirectTo)}`);
  return session;
}
