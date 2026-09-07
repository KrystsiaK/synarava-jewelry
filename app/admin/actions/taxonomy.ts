"use server";

import { requireAdminSession } from "@/lib/auth/admin-session";
import {
  searchShopifyTaxonomyCategories,
} from "@/lib/shopify/taxonomy";
import type { ShopifyTaxonomyCategory } from "@/lib/shopify/taxonomy-selection";

export type ShopifyTaxonomySearchResult = {
  categories: ShopifyTaxonomyCategory[];
  error?: string;
};

export async function searchShopifyTaxonomyCategoriesAction(
  search: string,
): Promise<ShopifyTaxonomySearchResult> {
  await requireAdminSession("/admin/products");

  if (typeof search !== "string") {
    return { categories: [], error: "Enter a category name to search." };
  }

  try {
    return { categories: await searchShopifyTaxonomyCategories(search) };
  } catch (error) {
    return {
      categories: [],
      error: error instanceof Error ? error.message : "Shopify category search failed.",
    };
  }
}
