/**
 * ONE field registry per entity type — labels, scopes, apply capability.
 * Detection stays deepDiff of derived windows (ADR-0003 / ADR-0009).
 * synaravaOnly fields are never placed in the commerce compare window.
 */

export type FieldScope = "base" | "locale" | "synaravaOnly";

export type SyncFieldDef = {
  key: string;
  label: string;
  scope: FieldScope;
  /** Shopify-shaped path(s) in the commerce window (empty = not in window). */
  windowPaths: readonly string[];
  /** Safe for field-by-field Apply (scoped write). */
  scopedApply: boolean;
};

export const PRODUCT_COMMERCE_FIELDS: readonly SyncFieldDef[] = [
  { key: "title", label: "Name", scope: "locale", windowPaths: ["title"], scopedApply: true },
  { key: "handle", label: "Handle", scope: "locale", windowPaths: ["handle"], scopedApply: true },
  { key: "descriptionHtml", label: "Description", scope: "locale", windowPaths: ["descriptionHtml"], scopedApply: false },
  { key: "vendor", label: "Vendor", scope: "base", windowPaths: ["vendor"], scopedApply: true },
  { key: "productType", label: "Product type", scope: "base", windowPaths: ["productType"], scopedApply: true },
  { key: "tags", label: "Tags", scope: "base", windowPaths: ["tags"], scopedApply: false },
  { key: "status", label: "Status", scope: "base", windowPaths: ["status"], scopedApply: false },
  { key: "seoTitle", label: "SEO title", scope: "locale", windowPaths: ["seo.title"], scopedApply: false },
  { key: "seoDescription", label: "SEO description", scope: "locale", windowPaths: ["seo.description"], scopedApply: false },
  { key: "category", label: "Product category", scope: "base", windowPaths: ["category", "category.id"], scopedApply: false },
  { key: "media", label: "Media gallery", scope: "base", windowPaths: ["media"], scopedApply: true },
  { key: "publications", label: "Publications", scope: "base", windowPaths: ["publications"], scopedApply: false },
  { key: "options", label: "Options", scope: "base", windowPaths: ["options"], scopedApply: false },
  { key: "collections", label: "Collections", scope: "base", windowPaths: ["collections"], scopedApply: false },
  { key: "metafields", label: "Metafields", scope: "base", windowPaths: ["metafields"], scopedApply: false },
  { key: "sku", label: "Variant SKU", scope: "base", windowPaths: ["variants[].sku"], scopedApply: true },
  { key: "price", label: "Price", scope: "base", windowPaths: ["variants[].price"], scopedApply: true },
  { key: "compareAtPrice", label: "Compare-at price", scope: "base", windowPaths: ["variants[].compareAtPrice"], scopedApply: true },
  { key: "taxable", label: "Charge tax", scope: "base", windowPaths: ["variants[].taxable"], scopedApply: true },
  { key: "inventoryQuantity", label: "Available quantity", scope: "base", windowPaths: ["variants[].inventoryQuantity", "totalInventory"], scopedApply: false },
  { key: "barcode", label: "Barcode", scope: "base", windowPaths: ["variants[].barcode"], scopedApply: false },
  { key: "inventoryPolicy", label: "Inventory policy", scope: "base", windowPaths: ["variants[].inventoryPolicy"], scopedApply: false },
  { key: "unitCost", label: "Cost", scope: "base", windowPaths: ["variants[].inventoryItem.unitCost"], scopedApply: false },
  { key: "countryCodeOfOrigin", label: "Country of origin", scope: "base", windowPaths: ["variants[].inventoryItem.countryCodeOfOrigin"], scopedApply: false },
  { key: "harmonizedSystemCode", label: "HS code", scope: "base", windowPaths: ["variants[].inventoryItem.harmonizedSystemCode"], scopedApply: false },
  // synaravaOnly — never in commerce window / never conflicts
  { key: "passport", label: "Synarava Passport", scope: "synaravaOnly", windowPaths: [], scopedApply: false },
  { key: "note", label: "Note", scope: "synaravaOnly", windowPaths: [], scopedApply: false },
] as const;

export const COLLECTION_COMMERCE_FIELDS: readonly SyncFieldDef[] = [
  { key: "title", label: "Name", scope: "locale", windowPaths: ["title"], scopedApply: true },
  { key: "handle", label: "Handle", scope: "locale", windowPaths: ["handle"], scopedApply: true },
  { key: "descriptionHtml", label: "Description", scope: "locale", windowPaths: ["descriptionHtml"], scopedApply: true },
  { key: "seoTitle", label: "SEO title", scope: "locale", windowPaths: ["seo.title"], scopedApply: true },
  { key: "seoDescription", label: "SEO description", scope: "locale", windowPaths: ["seo.description"], scopedApply: true },
] as const;

const SCOPED_PRODUCT_LABELS = new Set(
  PRODUCT_COMMERCE_FIELDS.filter((f) => f.scopedApply).map((f) => f.label),
);
const SCOPED_COLLECTION_LABELS = new Set(
  COLLECTION_COMMERCE_FIELDS.filter((f) => f.scopedApply).map((f) => f.label),
);

export function isScopedProductCommerceLabel(label: string): boolean {
  return SCOPED_PRODUCT_LABELS.has(label);
}

export function isScopedCollectionCommerceLabel(label: string): boolean {
  return SCOPED_COLLECTION_LABELS.has(label);
}

/** All commerce labels that participate in scoped Apply (product ∪ collection). */
export function isScopedCommerceFieldLabel(label: string): boolean {
  return isScopedProductCommerceLabel(label) || isScopedCollectionCommerceLabel(label);
}

export function labelForWindowPath(path: string): string {
  const normalized = path.replace(/\[\d+\]/g, "[]");
  for (const field of PRODUCT_COMMERCE_FIELDS) {
    if (field.windowPaths.some((p) => p === path || p === normalized || normalized.startsWith(p.replace("[]", "")))) {
      return field.label;
    }
  }
  for (const field of COLLECTION_COMMERCE_FIELDS) {
    if (field.windowPaths.some((p) => p === path || p === normalized)) return field.label;
  }
  // Fallback: last segment
  const leaf = path.split(".").pop() ?? path;
  return leaf.replace(/\[\d+\]/g, "");
}
