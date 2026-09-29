"use server";

import { revalidatePath } from "next/cache";

import { requireAdminSession } from "@/lib/auth/admin-session";
import { normalizeRichTextForStorage } from "@/lib/content/rich-text";
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
    const raw = String(formData.get(field.key) ?? "");
    updates[field.key] = field.area ? normalizeRichTextForStorage(raw) : raw;
  }

  await setSiteSeo(updates);
  revalidatePath("/", "layout");
  revalidatePath("/admin/meta");

  return { success: "Site SEO saved." };
}
