import "server-only";

import { z } from "zod";

import { shopifyAdminRequest, ShopifyAdminError } from "@/lib/shopify/admin";
import type { ShopifyTaxonomyCategory } from "@/lib/shopify/taxonomy-selection";

const taxonomyCategorySchema = z.object({
  id: z.string().regex(/^gid:\/\/shopify\/TaxonomyCategory\/[A-Za-z0-9-]+$/),
  name: z.string().min(1),
  fullName: z.string().min(1),
});

const taxonomySearchResponseSchema = z.object({
  taxonomy: z.object({
    categories: z.object({
      nodes: z.array(taxonomyCategorySchema),
    }),
  }),
});

export async function searchShopifyTaxonomyCategories(
  search: string,
  first = 20,
): Promise<ShopifyTaxonomyCategory[]> {
  const normalizedSearch = search.trim();
  if (!normalizedSearch) return [];

  const data = await shopifyAdminRequest<unknown>(
    `query SynaravaTaxonomyCategories($search: String!, $first: Int!) {
      taxonomy {
        categories(search: $search, first: $first) {
          nodes { id name fullName }
        }
      }
    }`,
    {
      search: normalizedSearch.slice(0, 120),
      first: Math.min(50, Math.max(1, Math.trunc(first))),
    },
  );

  const parsed = taxonomySearchResponseSchema.safeParse(data);
  if (!parsed.success) {
    throw new ShopifyAdminError("Shopify returned an invalid taxonomy response.");
  }

  return parsed.data.taxonomy.categories.nodes;
}
