import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ensureAuthSeed } from "@/lib/auth/bootstrap";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

const SESSION_COOKIE = "synarava-session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 14;

function getSessionSecret() {
  return env.AUTH_SESSION_SECRET ?? env.NEXTAUTH_SECRET ?? "synarava-dev-session-secret";
}

function signSessionToken(token: string) {
  return createHash("sha256").update(`${token}:${getSessionSecret()}`).digest("hex");
}

export async function createUserSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const sessionToken = signSessionToken(token);
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000);

  await db.userSession.create({
    data: {
      sessionToken,
      expiresAt,
      userId,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
    expires: expiresAt,
  });
}

export async function clearUserSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    await db.userSession.deleteMany({
      where: {
        sessionToken: signSessionToken(token),
      },
    });
  }

  cookieStore.delete(SESSION_COOKIE);
}

export async function getCurrentSession() {
  await ensureAuthSeed();

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  const session = await db.userSession.findUnique({
    where: {
      sessionToken: signSessionToken(token),
    },
    include: {
      user: {
        include: {
          roles: {
            include: {
              role: {
                include: {
                  permissions: {
                    include: {
                      permission: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!session) {
    cookieStore.delete(SESSION_COOKIE);
    return null;
  }

  if (session.expiresAt.getTime() <= Date.now()) {
    await db.userSession.delete({ where: { id: session.id } });
    cookieStore.delete(SESSION_COOKIE);
    return null;
  }

  return session;
}

export async function getCurrentUser() {
  const session = await getCurrentSession();
  return session?.user ?? null;
}

export async function getCurrentUserPermissions() {
  const user = await getCurrentUser();

  if (!user) {
    return [];
  }

  return Array.from(
    new Set(
      user.roles.flatMap((assignment) =>
        assignment.role.permissions.map((permissionAssignment) => permissionAssignment.permission.key),
      ),
    ),
  );
}

export async function userHasPermission(permissionKey: string) {
  const permissions = await getCurrentUserPermissions();
  return permissions.includes(permissionKey);
}

export async function requireUser(redirectTo?: string) {
  const user = await getCurrentUser();

  if (!user) {
    redirect(`/login${redirectTo ? `?redirectTo=${encodeURIComponent(redirectTo)}` : ""}`);
  }

  return user;
}

export async function requirePermission(permissionKey: string, redirectTo?: string) {
  const user = await requireUser(redirectTo);
  const permissions = await getCurrentUserPermissions();

  if (!permissions.includes(permissionKey)) {
    redirect("/shop?error=admin-only");
  }

  return user;
}
