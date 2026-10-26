/**
 * Commerce field Apply policy + Adopt Shopify synthetic leaf.
 * Scoped label sets live in `lib/sync/field-registry` (ADR-0009); re-exported here
 * so existing imports keep working.
 */

import {
  COLLECTION_COMMERCE_FIELDS,
  PRODUCT_COMMERCE_FIELDS,
  isScopedCollectionCommerceLabel,
  isScopedCommerceFieldLabel as isScopedCommerceFieldLabelFromRegistry,
  isScopedProductCommerceLabel,
} from "@/lib/sync/field-registry";

/** @deprecated Prefer field-registry; kept for callers that iterate the Set. */
export const SCOPED_COMMERCE_FIELD_LABELS = new Set(
  PRODUCT_COMMERCE_FIELDS.filter((f) => f.scopedApply).map((f) => f.label),
);

/** @deprecated Prefer field-registry; kept for callers that iterate the Set. */
export const SCOPED_COLLECTION_COMMERCE_FIELD_LABELS = new Set(
  COLLECTION_COMMERCE_FIELDS.filter((f) => f.scopedApply).map((f) => f.label),
);

export const SCOPED_PRODUCT_COMMERCE_FIELD_LABELS = SCOPED_COMMERCE_FIELD_LABELS;

/** Synthetic commerce row when Synarava has no derived OUR window (human Adopt). */
export const ADOPT_SHOPIFY_FIELD_KEY = "commerce:adopt-shopify";
export const ADOPT_SHOPIFY_FIELD_LABEL = "Adopt Shopify";
export const ADOPT_SHOPIFY_FIELD_PATH = "_adopt";

/** Media gallery rows — adopt whole `media` (Pull) or Push pipeline (Push). */
export function isMediaGalleryFieldLabel(label: string): boolean {
  return label === "Media gallery"
    || label.startsWith("Media gallery (")
    || /^Image \d+(\s|$)/.test(label);
}

export function isScopedCommerceFieldLabel(label: string): boolean {
  return isScopedCommerceFieldLabelFromRegistry(label) || isMediaGalleryFieldLabel(label);
}

export function isScopedCollectionCommerceFieldLabel(label: string): boolean {
  return isScopedCollectionCommerceLabel(label);
}

export { isScopedProductCommerceLabel };

export function isAdoptShopifyConflictField(field: {
  fieldKey?: string | null;
  path?: string | null;
  label?: string | null;
}): boolean {
  return field.fieldKey === ADOPT_SHOPIFY_FIELD_KEY
    || field.path === ADOPT_SHOPIFY_FIELD_PATH
    || field.label === ADOPT_SHOPIFY_FIELD_LABEL;
}

export const COMMERCE_UNSUPPORTED_REASON =
  "No safe field-by-field write yet (e.g. Status, tags). Resolve with Pull (take Shopify) or Push (send Synarava) for the whole commerce record.";
