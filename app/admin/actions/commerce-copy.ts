"use server";

import { revalidatePath } from "next/cache";

import { requireAdminSession } from "@/lib/auth/admin-session";
import {
  COMMERCE_COPY_KEYS,
  MOVED_HEADER_ACCOUNT_KEYS,
  type LocaleCopy,
} from "@/lib/content/commerce-copy-fields";
import { setCommerceCopy } from "@/lib/content/commerce-copy";
import { setStorefrontCopy } from "@/lib/content/storefront-copy";
import { getStorefrontLocales } from "@/lib/i18n/storefront-locale-cache";

export type CommerceCopyActionState = {
  error?: string;
  success?: string;
};

export async function saveCommerceCopyAction(formData: FormData): Promise<CommerceCopyActionState> {
  await requireAdminSession("/admin/commerce");

  const locales = await getStorefrontLocales();
  const updates: LocaleCopy = {};
  const legacyClear: LocaleCopy = {};
  for (const locale of locales) {
    const fields: Record<string, string> = {};
    for (const key of COMMERCE_COPY_KEYS) {
      fields[key] = String(formData.get(`${locale.code}:${key}`) ?? "");
    }
    updates[locale.code] = fields;
    legacyClear[locale.code] = Object.fromEntries(MOVED_HEADER_ACCOUNT_KEYS.map((key) => [key, ""]));
  }

  // Account-page keys live in the same setting and are written only by
  // saveAccountPageAction, so this save must not include them.
  await setCommerceCopy(updates);
  await setStorefrontCopy(legacyClear);
  revalidatePath("/", "layout");

  return { success: "Cart & account saved." };
}
