/**
 * Orphan Shopify-shaped commerce fields with no Prisma column/table home.
 * Merged into deriveProductWindow / deriveCollectionWindow at compare/push time.
 * @see docs/proposals/derive-synarava-state.md
 */

import type { MetafieldTranslations } from "@/lib/shopify/product-metafields-shared";

export type VariantInventoryExtras = {
  countryCodeOfOrigin?: string | null;
  harmonizedSystemCode?: string | null;
};

/** Product.extras — only keys that cannot live on columns/relations. */
export type ProductExtras = {
  media?: unknown[];
  publications?: unknown[];
  /** Full metafield list/map as last written (specs also mirrored to characteristics). */
  metafields?: unknown;
  metafieldTranslations?: MetafieldTranslations;
  options?: unknown[];
  category?: unknown;
  /** Keyed by shopifyVariantId, else sku. */
  variantInventory?: Record<string, VariantInventoryExtras>;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function variantExtrasKey(variant: Record<string, unknown>): string | null {
  if (typeof variant.id === "string" && variant.id.trim()) return variant.id;
  if (typeof variant.sku === "string" && variant.sku.trim()) return `sku:${variant.sku.trim()}`;
  return null;
}

/**
 * Extract no-other-home paths from a legacy workingSnapshot for migration backfill.
 * Column-backed scalars/variants/tags/collections are NOT copied here.
 */
export function extractProductExtrasFromWorkingSnapshot(working: unknown): ProductExtras | null {
  if (!isPlainObject(working)) return null;
  const extras: ProductExtras = {};

  if (Array.isArray(working.media)) extras.media = working.media;
  if (Array.isArray(working.publications)) extras.publications = working.publications;
  if (working.metafields !== undefined) extras.metafields = working.metafields;
  if (isPlainObject(working.metafieldTranslations)) {
    extras.metafieldTranslations = working.metafieldTranslations as MetafieldTranslations;
  }
  if (Array.isArray(working.options)) extras.options = working.options;
  if (working.category !== undefined) extras.category = working.category;

  if (Array.isArray(working.variants)) {
    const variantInventory: Record<string, VariantInventoryExtras> = {};
    for (const item of working.variants) {
      if (!isPlainObject(item)) continue;
      const key = variantExtrasKey(item);
      if (!key) continue;
      const inventoryItem = isPlainObject(item.inventoryItem) ? item.inventoryItem : null;
      if (!inventoryItem) continue;
      const patch: VariantInventoryExtras = {};
      if ("countryCodeOfOrigin" in inventoryItem) {
        const raw = inventoryItem.countryCodeOfOrigin;
        patch.countryCodeOfOrigin = typeof raw === "string" ? raw : raw == null ? null : String(raw);
      }
      if ("harmonizedSystemCode" in inventoryItem) {
        const raw = inventoryItem.harmonizedSystemCode;
        patch.harmonizedSystemCode = typeof raw === "string" ? raw : raw == null ? null : String(raw);
      }
      if (Object.keys(patch).length > 0) variantInventory[key] = patch;
    }
    if (Object.keys(variantInventory).length > 0) extras.variantInventory = variantInventory;
  }

  return Object.keys(extras).length > 0 ? extras : null;
}

/** Merge Shopify observation orphans into extras after Pull/Apply agree. */
export function productExtrasFromShopifySnapshot(shopify: unknown): ProductExtras {
  return extractProductExtrasFromWorkingSnapshot(shopify) ?? {};
}

export function parseProductExtras(raw: unknown): ProductExtras {
  if (!isPlainObject(raw)) return {};
  return raw as ProductExtras;
}
