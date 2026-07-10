"use server";

import { revalidatePath } from "next/cache";

import { requireAdminSession } from "@/lib/auth/admin-session";

export type AccountActionState = {
  error?: string;
  success?: string;
};

export async function updateAdminCredentialsAction(
  _prevState: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  await requireAdminSession("/admin/account");
  void formData;

  revalidatePath("/admin/account");
  return { error: "Admin credentials are managed through environment variables." };
}
