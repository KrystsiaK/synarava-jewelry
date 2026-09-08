"use server";

import { requireAdminSession } from "@/lib/auth/admin-session";
import {
  getShopifyCategoryAttributes,
  searchShopifyTaxonomyCategories,
  type ShopifyTaxonomyCategoryAttribute,
} from "@/lib/shopify/taxonomy";
import type { ShopifyTaxonomyCategory } from "@/lib/shopify/taxonomy-selection";

export type ShopifyTaxonomySearchResult = {
  categories: ShopifyTaxonomyCategory[];
  error?: string;
};

export type ShopifyTaxonomyAttributesResult = {
  attributes: ShopifyTaxonomyCategoryAttribute[];
  error?: string;
};

export async function getShopifyCategoryAttributesAction(
  categoryId: string,
): Promise<ShopifyTaxonomyAttributesResult> {
  await requireAdminSession("/admin/products");

  if (typeof categoryId !== "string" || !categoryId.trim()) {
    return { attributes: [] };
  }

  try {
    return { attributes: await getShopifyCategoryAttributes(categoryId) };
  } catch (error) {
    return {
      attributes: [],
      error: error instanceof Error ? error.message : "Shopify category attributes lookup failed.",
    };
  }
}

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
