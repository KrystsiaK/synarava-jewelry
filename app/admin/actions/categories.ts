import { db } from "@/lib/db";

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
