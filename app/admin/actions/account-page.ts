"use server";

import { revalidatePath } from "next/cache";

import { requireAdminSession } from "@/lib/auth/admin-session";
import { ACCOUNT_PAGE_KEYS } from "@/lib/content/account-page-fields";
import { setCommerceCopy } from "@/lib/content/commerce-copy";
import type { LocaleCopy } from "@/lib/content/commerce-copy-fields";
import { getStorefrontLocales } from "@/lib/i18n/storefront-locale-cache";

export type AccountPageActionState = {
  error?: string;
  success?: string;
};

export async function saveAccountPageAction(formData: FormData): Promise<AccountPageActionState> {
  await requireAdminSession("/admin/customer-account");

  const locales = await getStorefrontLocales();
  const updates: LocaleCopy = {};
  for (const locale of locales) {
    const fields: Record<string, string> = {};
    for (const key of ACCOUNT_PAGE_KEYS) {
      fields[key] = String(formData.get(`${locale.code}:${key}`) ?? "");
    }
    updates[locale.code] = fields;
  }

  // Merges into commerce-copy-v1. Only these keys are written, so a cart save
  // and this save do not erase each other.
  await setCommerceCopy(updates);
  revalidatePath("/", "layout");

  return { success: "Customer account saved." };
}
