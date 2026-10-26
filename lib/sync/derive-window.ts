/**
 * Derive OUR Shopify-shaped commerce window from real records + extras.
 * No stored workingSnapshot (ADR-0009).
 */

import {
  plainDescriptionToHtml,
  stripCollectionHtml,
} from "@/lib/shopify/collection-commerce-projection";
import {
  mirrorInventoryItem,
  mirrorProductCollections,
} from "@/lib/shopify/commerce-mirror-shape";
import { withMetafieldTranslations } from "@/lib/shopify/product-metafields-shared";
import { canonicalizeShopifyProjection } from "@/lib/shopify/shopify-projection-diff";
import {
  parseProductExtras,
  type ProductExtras,
  type VariantInventoryExtras,
} from "@/lib/sync/extras";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function centsToShopifyAmount(cents: number): string {
  return (Math.round(cents) / 100).toFixed(2);
}

function shopifyProductStatus(status: string): string {
  if (status === "ACTIVE" || status === "UNLISTED") return "ACTIVE";
  if (status === "ARCHIVED") return "ARCHIVED";
  return "DRAFT";
}

export type DeriveProductVariantInput = {
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
  weightGrams?: number | string | null;
};

export type DeriveProductInput = {
  shopifyProductId?: string | null;
  name: string;
  slug: string;
  description?: string | null;
  vendor?: string | null;
  productType?: string | null;
  status: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
  shopifyCategoryId?: string | null;
  shopifyCategoryName?: string | null;
  tags?: string[];
  collections?: Array<{ id: string; handle?: string; title?: string }>;
  variants: DeriveProductVariantInput[];
  extras?: unknown;
  /** Prefer existing descriptionHtml shape when stripped text matches. */
  preferredDescriptionHtml?: string | null;
};

function mergeVariantInventory(variant: DeriveProductVariantInput, extras: ProductExtras) {
  const key = (variant.shopifyVariantId?.trim())
    || (variant.sku.trim() ? `sku:${variant.sku.trim()}` : null);
  const orphan: VariantInventoryExtras | undefined = key
    ? extras.variantInventory?.[key]
    : undefined;
  const grams = variant.weightGrams != null ? Number(variant.weightGrams) : null;
  return mirrorInventoryItem({
    id: variant.shopifyInventoryItemId ?? null,
    requiresShipping: variant.requiresShipping ?? true,
    tracked: variant.tracked ?? true,
    ...(orphan && "countryCodeOfOrigin" in orphan
      ? { countryCodeOfOrigin: orphan.countryCodeOfOrigin ?? null } : {}),
    ...(orphan && "harmonizedSystemCode" in orphan
      ? { harmonizedSystemCode: orphan.harmonizedSystemCode ?? null } : {}),
    unitCost: variant.costCents != null
      ? { amount: centsToShopifyAmount(variant.costCents), currencyCode: "EUR" } : null,
    measurement: grams != null && grams > 0 ? { weight: { value: grams, unit: "GRAMS" } } : null,
  }) ?? {};
}

function descriptionHtmlForProduct(input: DeriveProductInput): string {
  const plain = (input.description ?? "").trim();
  const preferred = (input.preferredDescriptionHtml ?? "").trim();
  if (!plain) return "";
  if (preferred && stripCollectionHtml(preferred) === plain) return preferred;
  // Product descriptions are often already HTML from Shopify/admin rich text.
  if (/<[a-z][\s\S]*>/i.test(plain)) return plain;
  return plainDescriptionToHtml(plain);
}

/**
 * Build OUR product commerce window (Shopify-shaped) from columns + extras.
 */
export function deriveProductWindow(input: DeriveProductInput): unknown {
  const extras = parseProductExtras(input.extras);
  const variants = input.variants.map((variant) => ({
    id: variant.shopifyVariantId ?? null,
    title: variant.title,
    sku: variant.sku,
    barcode: variant.barcode ?? null,
    price: centsToShopifyAmount(variant.priceCents),
    compareAtPrice:
      variant.compareAtCents == null ? null : centsToShopifyAmount(variant.compareAtCents),
    inventoryPolicy: variant.inventoryPolicy ?? "DENY",
    inventoryQuantity: variant.stockOnHand,
    taxable: variant.taxable,
    selectedOptions: variant.selectedOptions ?? [],
    inventoryItem: mergeVariantInventory(variant, extras),
  }));

  const totalInventory = variants.reduce(
    (sum, item) => sum + (typeof item.inventoryQuantity === "number" ? item.inventoryQuantity : 0),
    0,
  );

  let category: unknown = extras.category;
  if (category == null && input.shopifyCategoryId) {
    category = {
      id: input.shopifyCategoryId,
      name: input.shopifyCategoryName ?? null,
    };
  }

  const raw = {
    id: input.shopifyProductId ?? null,
    title: input.name,
    handle: input.slug,
    descriptionHtml: descriptionHtmlForProduct(input),
    tags: input.tags ?? [],
    status: shopifyProductStatus(input.status),
    vendor: input.vendor ?? "",
    productType: input.productType ?? "",
    category: category ?? null,
    seo: {
      title: input.seoTitle ?? "",
      description: input.seoDescription ?? "",
    },
    media: extras.media ?? [],
    options: extras.options ?? [],
    metafields: extras.metafields ?? [],
    collections: mirrorProductCollections(input.collections ?? []),
    publications: extras.publications ?? [],
    totalInventory,
    variants,
  };

  const canonical = canonicalizeShopifyProjection(raw);
  if (extras.metafieldTranslations) {
    return withMetafieldTranslations(canonical, extras.metafieldTranslations);
  }
  return canonical;
}

export type DeriveCollectionInput = {
  shopifyCollectionId?: string | null;
  name: string;
  slug: string;
  description?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  preferredDescriptionHtml?: string | null;
  extras?: unknown;
};

/**
 * Build OUR collection commerce window (V1) from columns.
 */
export function deriveCollectionWindow(input: DeriveCollectionInput): unknown {
  const plain = (input.description ?? "").trim();
  const preferred = (input.preferredDescriptionHtml ?? "").trim();
  let descriptionHtml = "";
  if (!plain) {
    descriptionHtml = "";
  } else if (preferred && stripCollectionHtml(preferred) === plain) {
    descriptionHtml = preferred;
  } else if (/<[a-z][\s\S]*>/i.test(plain)) {
    descriptionHtml = plain;
  } else {
    descriptionHtml = plainDescriptionToHtml(plain);
  }

  return canonicalizeShopifyProjection({
    id: input.shopifyCollectionId ?? null,
    title: input.name,
    handle: input.slug,
    descriptionHtml,
    seo: {
      title: input.seoTitle ?? null,
      description: input.seoDescription ?? null,
    },
  });
}

/** Prefer HTML from shopifySnapshot when stripped text matches local description. */
export function preferredHtmlFromShopifySnapshot(
  shopifySnapshot: unknown,
  path: "descriptionHtml",
): string | null {
  if (!isPlainObject(shopifySnapshot)) return null;
  const value = shopifySnapshot[path];
  return typeof value === "string" ? value : null;
}
