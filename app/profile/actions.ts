"use server";

import { revalidatePath } from "next/cache";

import {
  assertAddressOwnership,
  checkRateLimit,
  requireAuthenticatedUser,
} from "@/lib/auth/guard";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { validatePasswordPolicy } from "@/lib/auth/password-policy";
import { db } from "@/lib/db";

export type ProfileActionState = { error?: string; success?: string };

export async function updateNameAction(
  _prev: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const user = await requireAuthenticatedUser();

  const name = String(formData.get("name") ?? "").trim().slice(0, 80);
  if (!name) return { error: "Name cannot be empty." };

  await db.user.update({ where: { id: user.id }, data: { name } });
  revalidatePath("/profile");
  return { success: "Name updated." };
}

export async function updatePasswordAction(
  _prev: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const user = await requireAuthenticatedUser();

  const limit = checkRateLimit("change-password", user.id, {
    max: 5,
    windowMs: 15 * 60 * 1000,
  });
  if (!limit.ok) return { error: limit.error };

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const nextPassword = String(formData.get("nextPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  const row = await db.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });

  if (!row?.passwordHash || !verifyPassword(currentPassword, row.passwordHash)) {
    return { error: "Current password is incorrect." };
  }

  const policy = validatePasswordPolicy(nextPassword);
  if (!policy.ok) return { error: policy.error };

  if (nextPassword !== confirmPassword) return { error: "Passwords do not match." };
  if (nextPassword === currentPassword) return { error: "New password must differ from current." };

  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: hashPassword(nextPassword) },
  });

  // Invalidate all sessions so stolen tokens are immediately useless.
  await db.userSession.deleteMany({ where: { userId: user.id } });

  revalidatePath("/profile");
  return { success: "Password changed. Please sign in again." };
}

export async function deleteAddressAction(
  _prev: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  await requireAuthenticatedUser();

  const addressId = String(formData.get("addressId") ?? "").trim();
  if (!addressId) return { error: "Invalid request." };

  try {
    await assertAddressOwnership(addressId);
  } catch {
    return { error: "Address not found." };
  }

  await db.address.delete({ where: { id: addressId } });
  revalidatePath("/profile");
  return { success: "Address removed." };
}

export async function setDefaultAddressAction(
  _prev: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const user = await requireAuthenticatedUser();

  const addressId = String(formData.get("addressId") ?? "").trim();
  if (!addressId) return { error: "Invalid request." };

  try {
    await assertAddressOwnership(addressId);
  } catch {
    return { error: "Address not found." };
  }

  await db.customerProfile.update({
    where: { userId: user.id },
    data: { defaultAddressId: addressId },
  });

  revalidatePath("/profile");
  return { success: "Default address updated." };
}

export async function revokeAllSessionsAction(
  _prev: ProfileActionState,
  _formData: FormData,
): Promise<ProfileActionState> {
  void _prev;
  void _formData;

  const user = await requireAuthenticatedUser();

  await db.userSession.deleteMany({ where: { userId: user.id } });

  revalidatePath("/profile");
  return { success: "All sessions revoked. Please sign in again." };
}
