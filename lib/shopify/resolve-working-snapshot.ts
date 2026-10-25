/**
 * Resolve the Synarava commerce window for compare / inspect.
 * Prefer persisted workingSnapshot; otherwise build from Synarava columns.
 * "Adopt Shopify" remains only when there is no Synarava row/counterpart.
 */

import { buildCollectionWindowFromColumns } from "@/lib/shopify/collection-commerce-projection";
import { writeThroughLocalCommerceToProjection } from "@/lib/shopify/shopify-projection-diff";

export type CollectionWorkingSource = {
  workingSnapshot: unknown | null;
  shopifySnapshot?: unknown | null;
  shopifyCollectionId?: string | null;
  name: string;
  slug: string;
  description?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
};

export type ProductWorkingSource = {
  workingSnapshot: unknown | null;
  shopifySnapshot?: unknown | null;
  name: string;
  slug: string;
  vendor?: string | null;
  productType?: string | null;
  priceCents?: number | null;
  variant?: {
    shopifyVariantId?: string | null;
    sku?: string | null;
    priceCents?: number | null;
    taxable?: boolean | null;
    inventoryQuantity?: number | null;
  } | null;
};

/** Synarava collection window: stored snapshot, else columns. */
export function resolveCollectionWorkingSnapshot(
  collection: CollectionWorkingSource,
): unknown | null {
  if (collection.workingSnapshot != null) return collection.workingSnapshot;
  const name = collection.name?.trim() ?? "";
  const slug = collection.slug?.trim() ?? "";
  if (!name && !slug) return null;
  return buildCollectionWindowFromColumns({
    shopifyCollectionId: collection.shopifyCollectionId,
    name,
    slug,
    description: collection.description,
    seoTitle: collection.seoTitle,
    seoDescription: collection.seoDescription,
    shopifySnapshot: collection.shopifySnapshot,
  });
}

/** Synarava product window: stored snapshot, else columns. */
export function resolveProductWorkingSnapshot(
  product: ProductWorkingSource,
): unknown | null {
  if (product.workingSnapshot != null) return product.workingSnapshot;
  const name = product.name?.trim() ?? "";
  const slug = product.slug?.trim() ?? "";
  if (!name && !slug) return null;
  return writeThroughLocalCommerceToProjection(product.shopifySnapshot ?? {}, {
    title: name,
    handle: slug,
    vendor: product.vendor,
    productType: product.productType,
    variant: product.variant
      ? {
          shopifyVariantId: product.variant.shopifyVariantId,
          sku: product.variant.sku ?? undefined,
          priceCents: product.variant.priceCents ?? product.priceCents ?? undefined,
          taxable: product.variant.taxable ?? undefined,
          inventoryQuantity: product.variant.inventoryQuantity ?? undefined,
        }
      : product.priceCents != null
        ? { priceCents: product.priceCents }
        : undefined,
  });
}
