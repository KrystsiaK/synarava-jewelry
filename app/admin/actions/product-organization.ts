"use server";

import { requireAdminSession } from "@/lib/auth/admin-session";
import { listShopifyProductOrganizationOptions } from "@/lib/shopify/product-organization";
import {
  SHOPIFY_PRODUCT_ORGANIZATION_KINDS,
  type ShopifyProductOrganizationKind,
} from "@/lib/shopify/product-organization-kinds";

export type ShopifyProductOrganizationResult = {
  options: string[];
  error?: string;
};

const KINDS = new Set<ShopifyProductOrganizationKind>(SHOPIFY_PRODUCT_ORGANIZATION_KINDS);

export async function listShopifyProductOrganizationAction(
  kind: ShopifyProductOrganizationKind,
): Promise<ShopifyProductOrganizationResult> {
  await requireAdminSession("/admin/products");

  if (!KINDS.has(kind)) {
    return { options: [], error: "Unknown Shopify organization list." };
  }

  try {
    return { options: await listShopifyProductOrganizationOptions(kind) };
  } catch (error) {
    return {
      options: [],
      error: error instanceof Error ? error.message : "Shopify organization lookup failed.",
    };
  }
}
