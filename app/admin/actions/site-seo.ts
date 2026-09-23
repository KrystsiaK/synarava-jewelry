"use server";

import { revalidatePath } from "next/cache";

import { requireAdminSession } from "@/lib/auth/admin-session";
import { setSiteSeo, type SiteSeoFields } from "@/lib/content/site-seo";
import { SITE_SEO_FIELD_DEFS } from "@/lib/content/site-seo-fields";

export type SiteSeoActionState = {
  error?: string;
  success?: string;
};

export async function saveSiteSeoAction(formData: FormData): Promise<SiteSeoActionState> {
  await requireAdminSession("/admin/meta");

  const updates: Partial<Record<keyof SiteSeoFields, string>> = {};
  for (const field of SITE_SEO_FIELD_DEFS) {
    updates[field.key] = String(formData.get(field.key) ?? "");
  }

  await setSiteSeo(updates);
  revalidatePath("/", "layout");
  revalidatePath("/admin/meta");

  return { success: "Site SEO saved." };
}
