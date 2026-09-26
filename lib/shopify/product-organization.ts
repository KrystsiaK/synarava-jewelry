import "server-only";

import { z } from "zod";

import { shopifyAdminRequest, ShopifyAdminError } from "@/lib/shopify/admin";
import type { ShopifyProductOrganizationKind } from "@/lib/shopify/product-organization-kinds";

export type { ShopifyProductOrganizationKind } from "@/lib/shopify/product-organization-kinds";

const stringConnectionSchema = z.object({
  nodes: z.array(z.string()),
  pageInfo: z.object({
    hasNextPage: z.boolean(),
    endCursor: z.string().nullable(),
  }),
});

const KIND_QUERY: Record<ShopifyProductOrganizationKind, string> = {
  vendors: "productVendors",
  types: "productTypes",
  tags: "productTags",
};

/** Page sizes from Shopify Admin GraphQL limits (vendors/types 1000, tags 5000). */
const KIND_PAGE_SIZE: Record<ShopifyProductOrganizationKind, number> = {
  vendors: 250,
  types: 250,
  tags: 500,
};

/**
 * Store-wide values already used on Shopify products.
 * @see https://shopify.dev/docs/api/admin-graphql/latest/queries/productTypes
 * @see https://shopify.dev/docs/api/admin-graphql/latest/queries/productVendors
 * @see https://shopify.dev/docs/api/admin-graphql/latest/queries/productTags
 */
export async function listShopifyProductOrganizationOptions(
  kind: ShopifyProductOrganizationKind,
  options?: { maxPages?: number },
): Promise<string[]> {
  const field = KIND_QUERY[kind];
  const first = KIND_PAGE_SIZE[kind];
  const maxPages = Math.min(8, Math.max(1, options?.maxPages ?? (kind === "tags" ? 4 : 2)));
  const values: string[] = [];
  let after: string | null = null;

  for (let page = 0; page < maxPages; page += 1) {
    const data = await shopifyAdminRequest<unknown>(
      `query SynaravaProductOrganization($first: Int!, $after: String) {
        ${field}(first: $first, after: $after) {
          nodes
          pageInfo { hasNextPage endCursor }
        }
      }`,
      { first, after },
    );

    const root = (data as Record<string, unknown> | null)?.[field];
    const parsed = stringConnectionSchema.safeParse(root);
    if (!parsed.success) {
      throw new ShopifyAdminError(`Shopify returned an invalid ${field} response.`);
    }

    for (const node of parsed.data.nodes) {
      const trimmed = node.trim();
      if (trimmed) values.push(trimmed);
    }

    if (!parsed.data.pageInfo.hasNextPage || !parsed.data.pageInfo.endCursor) break;
    after = parsed.data.pageInfo.endCursor;
  }

  return Array.from(new Set(values)).toSorted((a, b) => a.localeCompare(b));
}
