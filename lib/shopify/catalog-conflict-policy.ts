export const SCOPED_COMMERCE_FIELD_LABELS = new Set([
  "Name",
  "Handle",
  "Vendor",
  "Product type",
  "Variant SKU",
  "Price",
  "Compare-at price",
  "Charge tax",
]);

/** Collection commerce scalars from dual windows (title/handle/description/seo). */
export const SCOPED_COLLECTION_COMMERCE_FIELD_LABELS = new Set([
  "Name",
  "Handle",
  "Description",
  "SEO title",
  "SEO description",
]);

/** Synthetic commerce row when Synarava `workingSnapshot` is absent (human Adopt). */
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
  return SCOPED_COMMERCE_FIELD_LABELS.has(label) || isMediaGalleryFieldLabel(label);
}

export function isScopedCollectionCommerceFieldLabel(label: string): boolean {
  return SCOPED_COLLECTION_COMMERCE_FIELD_LABELS.has(label);
}

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
