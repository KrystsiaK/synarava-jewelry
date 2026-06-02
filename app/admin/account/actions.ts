"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser, requirePermission } from "@/lib/auth/session";
import { updateUserCredentials } from "@/lib/auth/users";

export type AccountActionState = {
  error?: string;
  success?: string;
};

export async function updateAdminCredentialsAction(
  _prevState: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  await requirePermission("admin.access", "/admin/account");

  const user = await getCurrentUser();

  if (!user) {
    return { error: "You need to be signed in." };
  }

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const nextEmail = String(formData.get("email") ?? "").trim();
  const nextPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!currentPassword) {
    return { error: "Current password is required." };
  }

  if (nextPassword && nextPassword.length < 8) {
    return { error: "New password must be at least 8 characters long." };
  }

  if (nextPassword && nextPassword !== confirmPassword) {
    return { error: "New passwords do not match." };
  }

  const result = await updateUserCredentials({
    userId: user.id,
    currentPassword,
    nextEmail: nextEmail || undefined,
    nextPassword: nextPassword || undefined,
  });

  if (!result.ok) {
    return { error: result.error };
  }

  revalidatePath("/admin/account");
  return { success: "Credentials updated." };
}
