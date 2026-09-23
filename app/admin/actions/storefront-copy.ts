"use server";

import { revalidatePath } from "next/cache";

import { requireAdminSession } from "@/lib/auth/admin-session";
import { setStorefrontCopy, type StorefrontCopy } from "@/lib/content/storefront-copy";
import { STOREFRONT_COPY_KEYS } from "@/lib/content/storefront-copy-fields";
import { getStorefrontLocales } from "@/lib/i18n/storefront-locale-cache";

export type StorefrontCopyActionState = {
  error?: string;
  success?: string;
};

export async function saveStorefrontCopyAction(formData: FormData): Promise<StorefrontCopyActionState> {
  await requireAdminSession("/admin/settings");

  const locales = await getStorefrontLocales();
  const updates: StorefrontCopy = {};
  for (const locale of locales) {
    const fields: Record<string, string> = {};
    for (const key of STOREFRONT_COPY_KEYS) {
      fields[key] = String(formData.get(`${locale.code}:${key}`) ?? "");
    }
    updates[locale.code] = fields;
  }

  await setStorefrontCopy(updates);

  // Footer and the main menu render in the root layout on every route — the only
  // things Storefront Copy still covers.
  revalidatePath("/", "layout");

  return { success: "Header & Footer saved." };
}
