/**
 * Pure Shopify snapshot → Synarava pull-state (derive input).
 * Shared by human pull (product-sync) and projection round-trip tests.
 */

import { sanitizeRichTextHtml } from "@/lib/content/rich-text";
import { weightInGrams } from "@/lib/shopify/commerce-mirror-shape";
import { shopifyAmountToCents } from "@/lib/shopify/money";
import { productExtrasFromShopifySnapshot } from "@/lib/sync/extras";
import type { DeriveProductInput, DeriveProductVariantInput } from "@/lib/sync/derive-window";

export type PullProductMappingOpts = {
  /** Override stock per Shopify variant GID (multi-location select). */
  stockByVariantId?: Record<string, number>;
  /** Product.currency; defaults from first unitCost.currencyCode or EUR. */
  currencyCode?: string;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** Snapshot money may be string or number after canonicalize. */
function moneyToCents(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value * 100);
  if (typeof value === "string") return shopifyAmountToCents(value);
  return 0;
}

function currencyFromSnapshot(snapshot: Record<string, unknown>): string {
  const variants = Array.isArray(snapshot.variants) ? snapshot.variants : [];
  for (const raw of variants) {
    if (!isPlainObject(raw)) continue;
    const inv = isPlainObject(raw.inventoryItem) ? raw.inventoryItem : null;
    const unitCost = inv && isPlainObject(inv.unitCost) ? inv.unitCost : null;
    const code = unitCost && typeof unitCost.currencyCode === "string"
      ? unitCost.currencyCode.trim()
      : "";
    if (code) return code;
  }
  return "EUR";
}

function mapVariant(
  raw: unknown,
  stockByVariantId: Record<string, number> | undefined,
): DeriveProductVariantInput {
  const v = isPlainObject(raw) ? raw : {};
  const inv = isPlainObject(v.inventoryItem) ? v.inventoryItem : {};
  const unitCost = isPlainObject(inv.unitCost) ? inv.unitCost : null;
  const measurement = isPlainObject(inv.measurement) ? inv.measurement : null;
  const weight = measurement && isPlainObject(measurement.weight)
    ? measurement.weight as { value: number; unit: "GRAMS" | "KILOGRAMS" | "OUNCES" | "POUNDS" }
    : null;
  const id = typeof v.id === "string" ? v.id : null;
  const stockOverride = id && stockByVariantId && id in stockByVariantId
    ? stockByVariantId[id]
    : undefined;
  return {
    shopifyVariantId: id,
    sku: String(v.sku ?? ""),
    title: String(v.title ?? ""),
    barcode: typeof v.barcode === "string" ? v.barcode : null,
    priceCents: moneyToCents(v.price),
    compareAtCents: v.compareAtPrice == null ? null : moneyToCents(v.compareAtPrice),
    costCents: unitCost && unitCost.amount != null ? moneyToCents(unitCost.amount) : null,
    inventoryPolicy: typeof v.inventoryPolicy === "string" ? v.inventoryPolicy : "DENY",
    stockOnHand: stockOverride ?? (typeof v.inventoryQuantity === "number" ? v.inventoryQuantity : 0),
    taxable: Boolean(v.taxable),
    selectedOptions: v.selectedOptions ?? [],
    shopifyInventoryItemId: typeof inv.id === "string" ? inv.id : null,
    requiresShipping: typeof inv.requiresShipping === "boolean" ? inv.requiresShipping : true,
    tracked: typeof inv.tracked === "boolean" ? inv.tracked : true,
    weightGrams: weightInGrams(weight),
  };
}

/**
 * Map a canonical Shopify product snapshot to Synarava pull columns + extras
 * suitable for `deriveProductWindow`. Description is sanitized like production pull.
 */
export function mapShopifyProductSnapshotToDeriveInput(
  snapshot: unknown,
  opts: PullProductMappingOpts = {},
): DeriveProductInput & { currency: string } {
  const snap = isPlainObject(snapshot) ? snapshot : {};
  const seo = isPlainObject(snap.seo) ? snap.seo : {};
  const category = isPlainObject(snap.category) ? snap.category : null;
  const descriptionHtml = typeof snap.descriptionHtml === "string" ? snap.descriptionHtml : "";
  const currency = (opts.currencyCode?.trim() || currencyFromSnapshot(snap)) || "EUR";

  const collections = Array.isArray(snap.collections)
    ? snap.collections.flatMap((c) => {
      if (!isPlainObject(c) || typeof c.id !== "string") return [];
      return [{
        id: c.id,
        handle: typeof c.handle === "string" ? c.handle : "",
        title: typeof c.title === "string" ? c.title : "",
      }];
    })
    : [];

  const variants = (Array.isArray(snap.variants) ? snap.variants : [])
    .map((raw) => mapVariant(raw, opts.stockByVariantId));

  return {
    shopifyProductId: typeof snap.id === "string" ? snap.id : null,
    name: String(snap.title ?? ""),
    slug: String(snap.handle ?? ""),
    description: sanitizeRichTextHtml(descriptionHtml) || null,
    preferredDescriptionHtml: descriptionHtml || null,
    vendor: typeof snap.vendor === "string" ? snap.vendor : null,
    productType: typeof snap.productType === "string" ? snap.productType : null,
    status: String(snap.status ?? "ACTIVE"),
    seoTitle: typeof seo.title === "string" ? seo.title || null : null,
    seoDescription: typeof seo.description === "string" ? seo.description || null : null,
    shopifyCategoryId: category && typeof category.id === "string" ? category.id : null,
    shopifyCategoryName: category
      ? (typeof category.fullName === "string" ? category.fullName
        : typeof category.name === "string" ? category.name
        : null)
      : null,
    tags: Array.isArray(snap.tags) ? snap.tags.map(String) : [],
    collections,
    variants,
    extras: productExtrasFromShopifySnapshot(snap),
    currency,
  };
}
