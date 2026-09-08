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
  values: string[];
};

const taxonomyAttributeValueSchema = z.object({ id: z.string(), name: z.string() });

const taxonomyAttributeNodeSchema = z.object({
  id: z.string(),
  name: z.string(),
  values: z.object({ nodes: z.array(taxonomyAttributeValueSchema) }).optional(),
});

const taxonomyAttributesResponseSchema = z.object({
  taxonomy: z.object({
    category: z.object({
      attributes: z.object({ nodes: z.array(taxonomyAttributeNodeSchema) }),
    }).nullable(),
  }),
});

/**
 * Discovers the attributes Shopify's Standard Product Taxonomy defines for
 * a category (e.g. a "Jewelry > Necklaces" category might define "Material"
 * and "Color" with a controlled list of values each). Read-only reference
 * data: this does not map or write any local characteristic to it. Writing
 * a value against one of these attributes requires setting a `shopify`
 * namespace metafield whose value is a reference to one of the specific
 * `TaxonomyValue` ids below — not a plain string — and that mapping (fuzzy
 * matching free text to a controlled vocabulary, or a dedicated picker per
 * attribute) is deliberately not implemented here.
 */
export async function getShopifyCategoryAttributes(categoryId: string): Promise<ShopifyTaxonomyCategoryAttribute[]> {
  const trimmedId = categoryId.trim();
  if (!trimmedId) return [];

  const data = await shopifyAdminRequest<unknown>(
    `query SynaravaTaxonomyCategoryAttributes($id: ID!) {
      taxonomy {
        category(id: $id) {
          attributes(first: 100) {
            nodes {
              ... on TaxonomyAttribute { id name }
              ... on TaxonomyChoiceListAttribute {
                id
                name
                values(first: 100) { nodes { id name } }
              }
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

  const category = parsed.data.taxonomy.category;
  if (!category) return [];

  return category.attributes.nodes.map((attribute) => ({
    id: attribute.id,
    name: attribute.name,
    values: attribute.values?.nodes.map((value) => value.name) ?? [],
  }));
}
