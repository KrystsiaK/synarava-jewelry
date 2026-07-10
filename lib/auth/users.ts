import { randomBytes } from "node:crypto";

import { ensureAuthSeed } from "@/lib/auth/bootstrap";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { db } from "@/lib/db";

async function getRoleId(key: string) {
  const role = await db.role.findUnique({
    where: { key },
    select: { id: true },
  });

  return role?.id ?? null;
}

export async function registerUser(input: {
  email: string;
  name?: string;
  password: string;
}) {
  await ensureAuthSeed();

  const email = input.email.trim().toLowerCase();
  const existing = await db.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existing) {
    return { ok: false as const, error: "An account with that email already exists." };
  }

  const customerRole = await getRoleId("customer");

  const user = await db.user.create({
    data: {
      email,
      name: input.name?.trim() || null,
      passwordHash: hashPassword(input.password),
      status: "ACTIVE",
    },
  });

  if (customerRole) {
    await db.userRole.create({
      data: {
        userId: user.id,
        roleId: customerRole,
      },
    });
  }

  return { ok: true as const, userId: user.id };
}

export async function authenticateUser(email: string, password: string) {
  await ensureAuthSeed();

  const user = await db.user.findUnique({
    where: { email: email.trim().toLowerCase() },
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
  });

  if (!user?.passwordHash) {
    return null;
  }

  if (!verifyPassword(password, user.passwordHash)) {
    return null;
  }

  return user;
}

export async function createPasswordResetToken(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await db.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, email: true },
  });

  if (!user) {
    return null;
  }

  const token = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60);

  await db.verificationToken.create({
    data: {
      identifier: normalizedEmail,
      token,
      type: "PASSWORD_RESET",
      expiresAt,
    },
  });

  return { token, expiresAt, email: normalizedEmail };
}

export async function getValidPasswordResetToken(token: string) {
  const record = await db.verificationToken.findUnique({
    where: { token },
  });

  if (!record || record.type !== "PASSWORD_RESET" || record.consumedAt || record.expiresAt.getTime() <= Date.now()) {
    return null;
  }

  return record;
}

export async function resetPasswordFromToken(token: string, password: string) {
  const record = await getValidPasswordResetToken(token);

  if (!record) {
    return { ok: false as const, error: "This reset link is invalid or has expired." };
  }

  await db.user.update({
    where: { email: record.identifier },
    data: {
      passwordHash: hashPassword(password),
      // Intentionally do NOT set status: "ACTIVE" — a SUSPENDED account must not
      // regain access through password reset.
    },
  });

  await db.verificationToken.update({
    where: { id: record.id },
    data: {
      consumedAt: new Date(),
    },
  });

  return { ok: true as const };
}

export async function updateUserCredentials(input: {
  userId: string;
  currentPassword: string;
  nextEmail?: string;
  nextPassword?: string;
}) {
  const user = await db.user.findUnique({
    where: { id: input.userId },
  });

  if (!user?.passwordHash || !verifyPassword(input.currentPassword, user.passwordHash)) {
    return { ok: false as const, error: "Current password is incorrect." };
  }

  const nextEmail = input.nextEmail?.trim().toLowerCase();

  if (nextEmail && nextEmail !== user.email) {
    const existing = await db.user.findUnique({
      where: { email: nextEmail },
      select: { id: true },
    });

    if (existing) {
      return { ok: false as const, error: "That email is already in use." };
    }
  }

  await db.user.update({
    where: { id: input.userId },
    data: {
      email: nextEmail && nextEmail !== user.email ? nextEmail : undefined,
      passwordHash: input.nextPassword ? hashPassword(input.nextPassword) : undefined,
    },
  });

  if (input.nextPassword) {
    // Invalidate all sessions so stolen tokens cannot be used after a password change.
    await db.userSession.deleteMany({ where: { userId: input.userId } });
  }

  return { ok: true as const };
}
