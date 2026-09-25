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

export type ShopifyTaxonomyCategoryAttribute = {
  id: string;
  name: string;
};

const taxonomyAttributeNodeSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
});

const taxonomyAttributesResponseSchema = z.object({
  node: z.object({
    attributes: z.object({ nodes: z.array(taxonomyAttributeNodeSchema) }),
  }).nullable(),
});

/**
 * Discovers the attribute *names* Shopify's Standard Product Taxonomy defines
 * for a category (e.g. Jewelry > Necklaces may define Material and Color).
 *
 * This is a checklist of expected fields — not the product's selected values
 * and not the full controlled vocabulary. Selected values live on the product
 * as `shopify.*` metafields and are resolved during pull
 * (`lib/shopify/category-attribute-values.ts`). Writing a value still requires
 * a TaxonomyValue / category metaobject reference, not free text.
 * https://shopify.dev/docs/api/admin-graphql/latest/objects/TaxonomyChoiceListAttribute
 */
export async function getShopifyCategoryAttributes(categoryId: string): Promise<ShopifyTaxonomyCategoryAttribute[]> {
  const trimmedId = categoryId.trim();
  if (!trimmedId) return [];

  const data = await shopifyAdminRequest<unknown>(
    `query SynaravaTaxonomyCategoryAttributes($id: ID!) {
      node(id: $id) {
        ... on TaxonomyCategory {
          attributes(first: 100) {
            nodes {
              ... on TaxonomyAttribute { id }
              ... on TaxonomyChoiceListAttribute { id name }
              ... on TaxonomyMeasurementAttribute { id name }
            }
          }
        }
      }
    }`,
    { id: trimmedId },
  );

  const parsed = taxonomyAttributesResponseSchema.safeParse(data);
  if (!parsed.success) {
    throw new ShopifyAdminError("Shopify returned an invalid taxonomy attributes response.");
  }

  const category = parsed.data.node;
  if (!category) return [];

  return category.attributes.nodes
    .filter((attribute): attribute is { id: string; name: string } => Boolean(attribute.name))
    .map((attribute) => ({
      id: attribute.id,
      name: attribute.name,
    }));
}
