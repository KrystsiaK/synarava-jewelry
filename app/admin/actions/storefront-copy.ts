"use server";

import { revalidatePath } from "next/cache";

import { requireAdminSession } from "@/lib/auth/admin-session";
import { setStorefrontCopy } from "@/lib/content/storefront-copy";
import { STOREFRONT_COPY_KEYS } from "@/lib/content/storefront-copy-fields";
import { revalidateStorefrontPath } from "@/lib/content/revalidate-storefront";

export type StorefrontCopyActionState = {
  error?: string;
  success?: string;
};

export async function saveStorefrontCopyAction(formData: FormData): Promise<StorefrontCopyActionState> {
  await requireAdminSession("/admin/settings");

  const en: Record<string, string> = {};
  const pt: Record<string, string> = {};
  for (const key of STOREFRONT_COPY_KEYS) {
    en[key] = String(formData.get(`en:${key}`) ?? "");
    pt[key] = String(formData.get(`pt:${key}`) ?? "");
  }

  await setStorefrontCopy({ en, pt });

  // Footer and the main menu render in the root layout on every route; the
  // FAQ/Care/Shipping/Returns copy lives on those specific pages only.
  revalidatePath("/", "layout");
  for (const path of ["/faq", "/care", "/shipping", "/returns"]) {
    revalidateStorefrontPath(path);
  }

  return { success: "Storefront copy updated." };
}
