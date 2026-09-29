"use server";

import { revalidatePath } from "next/cache";

import { requireAdminSession } from "@/lib/auth/admin-session";
import {
  setAccountOrdersSettings,
  type AccountOrdersSettings,
} from "@/lib/content/account-orders-settings";
import { ACCOUNT_ORDERS_SETTINGS_FIELD_DEFS } from "@/lib/content/account-orders-settings-fields";

export type AccountOrdersSettingsActionState = {
  error?: string;
  success?: string;
};

export async function saveAccountOrdersSettingsAction(
  formData: FormData,
): Promise<AccountOrdersSettingsActionState> {
  await requireAdminSession("/admin/customer-account");

  const updates: Partial<AccountOrdersSettings> = {};
  for (const field of ACCOUNT_ORDERS_SETTINGS_FIELD_DEFS) {
    // Unchecked checkboxes are omitted from FormData — treat missing as false.
    updates[field.key] = formData.get(field.key) === "true";
  }

  await setAccountOrdersSettings(updates);
  revalidatePath("/profile", "layout");
  revalidatePath("/admin/customer-account");

  return { success: "Order action settings saved." };
}
