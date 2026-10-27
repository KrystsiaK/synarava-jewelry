/**
 * Build OUR derived commerce window from a Prisma product/collection row shape.
 * Used by push/inspect/apply paths after workingSnapshot removal (ADR-0009).
 */

import {
  deriveCollectionWindow,
  deriveProductWindow,
  preferredHtmlFromShopifySnapshot,
  type DeriveProductVariantInput,
} from "@/lib/sync/derive-window";

export type ProductRowForOurWindow = {
  shopifyProductId?: string | null;
  name: string;
  slug: string;
  description?: string | null;
  vendor?: string | null;
  productType?: string | null;
  status: string;
  currency?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  shopifyCategoryId?: string | null;
  shopifyCategoryName?: string | null;
  extras?: unknown;
  shopifySnapshot?: unknown;
  tags?: Array<{ tag: { name: string } } | { name: string }>;
  collections?: Array<{
    collection: {
      shopifyCollectionId?: string | null;
      slug: string;
      name: string;
    };
  }>;
  variants?: Array<{
    shopifyVariantId?: string | null;
    sku: string;
    title: string;
    barcode?: string | null;
    priceCents: number;
    compareAtCents?: number | null;
    inventoryPolicy?: string | null;
    stockOnHand: number;
    taxable: boolean;
    selectedOptions?: unknown;
    shopifyInventoryItemId?: string | null;
    requiresShipping?: boolean | null;
    tracked?: boolean | null;
    costCents?: number | null;
    weightGrams?: number | string | { toNumber?: () => number } | null;
  }>;
};

function weightToNumber(
  value: number | string | { toNumber?: () => number } | null | undefined,
): number | null {
  if (value == null) return null;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  if (typeof value.toNumber === "function") return value.toNumber();
  return Number(value);
}

export function ourProductWindowFromRow(product: ProductRowForOurWindow): unknown | null {
  const name = product.name?.trim() ?? "";
  const slug = product.slug?.trim() ?? "";
  if (!name && !slug) return null;

  const tags = (product.tags ?? []).map((row) =>
    "tag" in row ? row.tag.name : row.name,
  );
  const collections = (product.collections ?? []).flatMap((row) => {
    const id = row.collection.shopifyCollectionId;
    if (!id || row.collection.slug === "frontpage") return [];
    return [{ id }];
  });
  const variants: DeriveProductVariantInput[] = (product.variants ?? []).map((variant) => ({
    shopifyVariantId: variant.shopifyVariantId,
    sku: variant.sku,
    title: variant.title,
    barcode: variant.barcode,
    priceCents: variant.priceCents,
    compareAtCents: variant.compareAtCents,
    inventoryPolicy: variant.inventoryPolicy,
    stockOnHand: variant.stockOnHand,
    taxable: variant.taxable,
    selectedOptions: variant.selectedOptions,
    shopifyInventoryItemId: variant.shopifyInventoryItemId,
    requiresShipping: variant.requiresShipping,
    tracked: variant.tracked,
    costCents: variant.costCents,
    weightGrams: weightToNumber(variant.weightGrams),
  }));

  return deriveProductWindow({
    shopifyProductId: product.shopifyProductId,
    name,
    slug,
    description: product.description,
    vendor: product.vendor,
    productType: product.productType,
    status: product.status,
    currency: product.currency,
    seoTitle: product.seoTitle,
    seoDescription: product.seoDescription,
    shopifyCategoryId: product.shopifyCategoryId,
    shopifyCategoryName: product.shopifyCategoryName,
    tags,
    collections,
    variants,
    extras: product.extras,
    preferredDescriptionHtml: preferredHtmlFromShopifySnapshot(
      product.shopifySnapshot,
      "descriptionHtml",
    ),
  });
}

export type CollectionRowForOurWindow = {
  shopifyCollectionId?: string | null;
  name: string;
  slug: string;
  description?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  extras?: unknown;
  shopifySnapshot?: unknown;
};

export function ourCollectionWindowFromRow(collection: CollectionRowForOurWindow): unknown | null {
  const name = collection.name?.trim() ?? "";
  const slug = collection.slug?.trim() ?? "";
  if (!name && !slug) return null;
  return deriveCollectionWindow({
    shopifyCollectionId: collection.shopifyCollectionId,
    name,
    slug,
    description: collection.description,
    seoTitle: collection.seoTitle,
    seoDescription: collection.seoDescription,
    extras: collection.extras,
    preferredDescriptionHtml: preferredHtmlFromShopifySnapshot(
      collection.shopifySnapshot,
      "descriptionHtml",
    ),
  });
}
