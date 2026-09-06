"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdminSession } from "@/lib/auth/admin-session";
import { db } from "@/lib/db";
import { parseFormData } from "@/lib/forms/parse-form-data";
import { slugify } from "@/lib/text/slug";
import { revalidateStorefront, writeAuditLog } from "./shared";

export type TagActionState = {
  error?: string;
  success?: string;
  tag?: SavedTagPayload;
  deletedTagId?: string;
  affectedProducts?: number;
};

export type SavedTagPayload = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  slug: string;
  name: string;
};

export async function getSavedTagPayload(tagId: string): Promise<SavedTagPayload> {
  const tag = await db.tag.findUnique({
    where: { id: tagId },
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
      slug: true,
      name: true,
    },
  });

  if (!tag) {
    throw new Error("Tag not found.");
  }

  return tag;
}

const saveTagSchema = z.object({
  tagId: z.string().trim().default(""),
  name: z.string().trim().min(1),
  slug: z.string().trim().default(""),
});

export async function saveTagAction(formData: FormData): Promise<TagActionState> {
  await requireAdminSession("/admin/products");

  const parsed = parseFormData(formData, saveTagSchema);
  if (!parsed.success) {
    return { error: "Tag name is required." };
  }
  const { tagId, name } = parsed.data;

  const slug = slugify(parsed.data.slug || name);
  const before = tagId ? await getSavedTagPayload(tagId).catch(() => null) : null;

  const tag = await db.tag.upsert({
    where: tagId ? { id: tagId } : { slug },
    update: {
      slug,
      name,
    },
    create: {
      slug,
      name,
    },
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
      slug: true,
      name: true,
    },
  });

  await writeAuditLog({
    action: tagId ? "UPDATE" : "CREATE",
    entityType: "TAG",
    entityId: tag.id,
    before,
    after: tag,
  });

  revalidateStorefront();
  revalidatePath("/admin/products");
  revalidatePath("/admin/tags");
  return { success: tagId ? "Tag updated." : "Tag created.", tag };
}

const deleteTagSchema = z.object({
  tagId: z.string().trim().min(1),
});

export async function deleteTagAction(formData: FormData): Promise<TagActionState> {
  await requireAdminSession("/admin/products");

  const parsed = parseFormData(formData, deleteTagSchema);
  if (!parsed.success) {
    return { error: "Tag id is missing." };
  }
  const { tagId } = parsed.data;

  const affectedProducts = await db.productTag.count({ where: { tagId } });

  await db.tag.delete({
    where: { id: tagId },
  });

  revalidateStorefront();
  revalidatePath("/admin/products");
  revalidatePath("/admin/tags");
  return {
    success: "Tag deleted and removed from products.",
    deletedTagId: tagId,
    affectedProducts,
  };
}
