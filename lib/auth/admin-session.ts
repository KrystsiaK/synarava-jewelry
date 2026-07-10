import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { verifyPassword } from "@/lib/auth/password";
import { env } from "@/lib/env";

const ADMIN_SESSION_COOKIE = "synarava-admin-session";
const ADMIN_SESSION_MAX_AGE = 60 * 60 * 8;

export type AdminSession = {
  username: string;
  id: null;
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

function signAdminValue(value: string): string {
  return createHmac("sha256", getAdminSessionSecret()).update(value).digest("hex");
}

function constantTimeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
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

  if (!credentials.username) {
    return false;
  }

  const usernameMatches = constantTimeEqual(username.trim(), credentials.username);
  const passwordMatches = credentials.passwordHash
    ? verifyPassword(password, credentials.passwordHash)
    : process.env.NODE_ENV !== "production" &&
      credentials.legacyPassword.length > 0 &&
      constantTimeEqual(password, credentials.legacyPassword);

  return usernameMatches && passwordMatches;
}

export async function createAdminSession() {
  const credentials = getAdminCredentials();

  if (!credentials.username) {
    throw new Error("ADMIN_USERNAME must be set before creating an admin session.");
  }

  const token = randomBytes(32).toString("hex");
  const issuedAt = Date.now().toString(36);
  const payload = `${credentials.username}:${issuedAt}:${token}`;
  const signature = signAdminValue(payload);
  const expiresAt = new Date(Date.now() + ADMIN_SESSION_MAX_AGE * 1000);

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, `${payload}.${signature}`, {
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
  const raw = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;

  if (!raw) {
    return null;
  }

  const separator = raw.lastIndexOf(".");
  if (separator === -1) {
    return null;
  }

  const payload = raw.slice(0, separator);
  const signature = raw.slice(separator + 1);

  if (!constantTimeEqual(signature, signAdminValue(payload))) {
    return null;
  }

  const [username, issuedAt] = payload.split(":");
  const credentials = getAdminCredentials();
  const issuedAtMs = Number.parseInt(issuedAt ?? "", 36);

  if (!username || !issuedAtMs || !credentials.username) {
    return null;
  }

  if (!constantTimeEqual(username, credentials.username)) {
    return null;
  }

  if (Date.now() - issuedAtMs > ADMIN_SESSION_MAX_AGE * 1000) {
    return null;
  }

  return {
    username,
    id: null,
  };
}

export async function requireAdminSession(redirectTo = "/admin") {
  const session = await getCurrentAdminSession();

  if (!session) {
    redirect(`/admin/login?redirectTo=${encodeURIComponent(redirectTo)}`);
  }

  return session;
}
