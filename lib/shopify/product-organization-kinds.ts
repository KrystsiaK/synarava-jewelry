/** Shared client/server kinds for Shopify product organization suggest lists. */
export type ShopifyProductOrganizationKind = "vendors" | "types" | "tags";

export const SHOPIFY_PRODUCT_ORGANIZATION_KINDS = [
  "vendors",
  "types",
  "tags",
] as const satisfies readonly ShopifyProductOrganizationKind[];
