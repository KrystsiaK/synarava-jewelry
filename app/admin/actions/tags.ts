"use server";

import { revalidatePath } from "next/cache";

import { requireAdminSession } from "@/lib/auth/admin-session";
import { db } from "@/lib/db";
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

export function parseTags(raw: string) {
  return Array.from(
    new Set(
      raw
        .split(",")
        .map((item) => slugify(item))
        .filter(Boolean),
    ),
  );
}

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

export async function saveTagAction(formData: FormData): Promise<TagActionState> {
  await requireAdminSession("/admin/products");

  const tagId = String(formData.get("tagId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    return { error: "Tag name is required." };
  }

  const slug = slugify(String(formData.get("slug") ?? "") || name);
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

export async function deleteTagAction(formData: FormData): Promise<TagActionState> {
  await requireAdminSession("/admin/products");

  const tagId = String(formData.get("tagId") ?? "").trim();

  if (!tagId) {
    return { error: "Tag id is missing." };
  }

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
