"use server";

import { revalidatePath } from "next/cache";

import { requireAdminSession } from "@/lib/auth/admin-session";
import { db } from "@/lib/db";
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

export async function saveCategoryAction(formData: FormData): Promise<CategoryActionState> {
  await requireAdminSession("/admin/products");

  const categoryId = String(formData.get("categoryId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    return { error: "Category name is required." };
  }

  const slug = slugify(String(formData.get("slug") ?? "") || name);
  const description = String(formData.get("description") ?? "").trim();
  const sortOrder = Number(String(formData.get("sortOrder") ?? "0").trim() || "0");
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

export async function deleteCategoryAction(formData: FormData): Promise<CategoryActionState> {
  await requireAdminSession("/admin/products");

  const categoryId = String(formData.get("categoryId") ?? "").trim();

  if (!categoryId) {
    return { error: "Category id is missing." };
  }

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
