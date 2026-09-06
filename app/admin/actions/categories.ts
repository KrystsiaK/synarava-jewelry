"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdminSession } from "@/lib/auth/admin-session";
import { db } from "@/lib/db";
import { parseFormData } from "@/lib/forms/parse-form-data";
import { slugify } from "@/lib/text/slug";
import { revalidateStorefront, writeAuditLog } from "./shared";

export type CategoryActionState = {
  error?: string;
  success?: string;
  category?: SavedCategoryPayload;
  deletedCategoryId?: string;
  affectedProducts?: number;
};

export type SavedCategoryPayload = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  slug: string;
  name: string;
  description: string | null;
  sortOrder: number;
};

export async function getSavedCategoryPayload(categoryId: string): Promise<SavedCategoryPayload> {
  const category = await db.productCategory.findUnique({
    where: { id: categoryId },
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
      slug: true,
      name: true,
      description: true,
      sortOrder: true,
    },
  });

  if (!category) {
    throw new Error("Category not found.");
  }

  return category;
}

const saveCategorySchema = z.object({
  categoryId: z.string().trim().default(""),
  name: z.string().trim().min(1),
  slug: z.string().trim().default(""),
  description: z.string().trim().default(""),
  sortOrder: z.string().trim().default("0"),
});

export async function saveCategoryAction(formData: FormData): Promise<CategoryActionState> {
  await requireAdminSession("/admin/products");

  const parsed = parseFormData(formData, saveCategorySchema);
  if (!parsed.success) {
    return { error: "Category name is required." };
  }
  const { categoryId, name, description } = parsed.data;

  const slug = slugify(parsed.data.slug || name);
  const sortOrder = Number(parsed.data.sortOrder || "0");
  const before = categoryId ? await getSavedCategoryPayload(categoryId).catch(() => null) : null;

  const category = await db.productCategory.upsert({
    where: categoryId ? { id: categoryId } : { slug },
    update: {
      slug,
      name,
      description,
      sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
    },
    create: {
      slug,
      name,
      description,
      sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
    },
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
      slug: true,
      name: true,
      description: true,
      sortOrder: true,
    },
  });

  await writeAuditLog({
    action: categoryId ? "UPDATE" : "CREATE",
    entityType: "CATEGORY",
    entityId: category.id,
    before,
    after: category,
  });

  revalidateStorefront();
  revalidatePath("/admin/products");
  revalidatePath("/admin/categories");
  return { success: categoryId ? "Category updated." : "Category created.", category };
}

const deleteCategorySchema = z.object({
  categoryId: z.string().trim().min(1),
});

export async function deleteCategoryAction(formData: FormData): Promise<CategoryActionState> {
  await requireAdminSession("/admin/products");

  const parsed = parseFormData(formData, deleteCategorySchema);
  if (!parsed.success) {
    return { error: "Category id is missing." };
  }
  const { categoryId } = parsed.data;

  const affectedProducts = await db.product.count({ where: { categoryId } });

  await db.productCategory.delete({
    where: { id: categoryId },
  });

  revalidateStorefront();
  revalidatePath("/admin/products");
  revalidatePath("/admin/categories");
  return {
    success: "Category deleted. Products that used it now have no category.",
    deletedCategoryId: categoryId,
    affectedProducts,
  };
}
