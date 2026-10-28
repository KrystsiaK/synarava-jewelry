/**
 * ONE declarative field contract per Shopify commerce field (product + collection).
 * Metadata only — no read/write plans, interpreters, Prisma, network, or React.
 * Detection stays deepDiff of derived windows (ADR-0003 / ADR-0009).
 */

/** Editor section id — lives in lib so leaves/consumers never import components. */
export type SyncConflictSection =
  | "essentials"
  | "price"
  | "inventory"
  | "metafields"
  | "media"
  | "details"
  | "passport"
  | "shopify";

export type FieldScope = "base" | "locale" | "synaravaOnly";
export type FieldOwnership = "shopify" | "synarava" | "shared";
export type FieldValueType =
  | "string"
  | "number"
  | "boolean"
  | "money"
  | "html"
  | "json"
  | "list"
  | "identity"
  | "weight"
  | "enum";
export type ApplyCapability = "scoped" | "whole-record-only" | "unsupported";

export type SyncFieldDef = {
  /** Stable contract id (unique across product ∪ collection registries). */
  contractKey: string;
  key: string;
  label: string;
  scope: FieldScope;
  section: SyncConflictSection;
  ownership: FieldOwnership;
  valueType: FieldValueType;
  /** Id of the canonical normalizer used on this field (documented, not a callback). */
  normalizerId: string;
  /** Shopify-shaped path pattern(s) in the commerce window (empty = not in window). */
  windowPaths: readonly string[];
  applyToSynarava: ApplyCapability;
  applyToShopify: ApplyCapability;
  /** True when both apply directions support field-by-field Apply. */
  scopedApply: boolean;
};

function field(
  def: Omit<SyncFieldDef, "scopedApply" | "contractKey"> & { contractKey?: string },
): SyncFieldDef {
  const applyToSynarava = def.applyToSynarava;
  const applyToShopify = def.applyToShopify;
  return {
    ...def,
    contractKey: def.contractKey ?? def.key,
    scopedApply: applyToSynarava === "scoped" && applyToShopify === "scoped",
  };
}

export const PRODUCT_COMMERCE_FIELDS: readonly SyncFieldDef[] = [
  field({
    key: "title", label: "Name", scope: "locale", section: "essentials",
    ownership: "shared", valueType: "string", normalizerId: "trim-string",
    windowPaths: ["title"], applyToSynarava: "scoped", applyToShopify: "scoped",
  }),
  field({
    key: "handle", label: "Handle", scope: "locale", section: "essentials",
    ownership: "shared", valueType: "string", normalizerId: "handle",
    windowPaths: ["handle"], applyToSynarava: "scoped", applyToShopify: "scoped",
  }),
  field({
    key: "descriptionHtml", label: "Description", scope: "locale", section: "essentials",
    ownership: "shared", valueType: "html", normalizerId: "sanitize-html",
    windowPaths: ["descriptionHtml"], applyToSynarava: "whole-record-only", applyToShopify: "whole-record-only",
  }),
  field({
    key: "vendor", label: "Vendor", scope: "base", section: "essentials",
    ownership: "shopify", valueType: "string", normalizerId: "trim-string",
    windowPaths: ["vendor"], applyToSynarava: "scoped", applyToShopify: "scoped",
  }),
  field({
    key: "productType", label: "Product type", scope: "base", section: "essentials",
    ownership: "shopify", valueType: "string", normalizerId: "trim-string",
    windowPaths: ["productType"], applyToSynarava: "scoped", applyToShopify: "scoped",
  }),
  field({
    key: "tags", label: "Tags", scope: "base", section: "essentials",
    ownership: "shopify", valueType: "list", normalizerId: "sorted-string-list",
    windowPaths: ["tags"], applyToSynarava: "whole-record-only", applyToShopify: "whole-record-only",
  }),
  field({
    key: "status", label: "Status", scope: "base", section: "essentials",
    ownership: "shopify", valueType: "enum", normalizerId: "product-status",
    windowPaths: ["status"], applyToSynarava: "whole-record-only", applyToShopify: "whole-record-only",
  }),
  field({
    key: "seoTitle", label: "SEO title", scope: "locale", section: "essentials",
    ownership: "shared", valueType: "string", normalizerId: "trim-string",
    windowPaths: ["seo.title"], applyToSynarava: "whole-record-only", applyToShopify: "whole-record-only",
  }),
  field({
    key: "seoDescription", label: "SEO description", scope: "locale", section: "essentials",
    ownership: "shared", valueType: "string", normalizerId: "trim-string",
    windowPaths: ["seo.description"], applyToSynarava: "whole-record-only", applyToShopify: "whole-record-only",
  }),
  field({
    key: "category", label: "Product category", scope: "base", section: "essentials",
    ownership: "shopify", valueType: "identity", normalizerId: "category-id",
    windowPaths: ["category", "category.id"], applyToSynarava: "whole-record-only", applyToShopify: "whole-record-only",
  }),
  field({
    key: "media", label: "Media gallery", scope: "base", section: "media",
    ownership: "shopify", valueType: "list", normalizerId: "media-gallery",
    // Whole-gallery adopt path; identity leaves use media.* keys below.
    windowPaths: ["media"], applyToSynarava: "scoped", applyToShopify: "scoped",
  }),
  field({
    key: "mediaRemoved", contractKey: "media.removed", label: "Removed photo",
    scope: "base", section: "media", ownership: "shopify", valueType: "identity",
    normalizerId: "media-gallery-identity", windowPaths: [],
    applyToSynarava: "scoped", applyToShopify: "scoped",
  }),
  field({
    key: "mediaAdded", contractKey: "media.added", label: "New photo",
    scope: "base", section: "media", ownership: "shopify", valueType: "identity",
    normalizerId: "media-gallery-identity", windowPaths: [],
    applyToSynarava: "scoped", applyToShopify: "scoped",
  }),
  field({
    key: "mediaMoved", contractKey: "media.moved", label: "Photo order",
    scope: "base", section: "media", ownership: "shopify", valueType: "list",
    normalizerId: "media-gallery-identity", windowPaths: [],
    applyToSynarava: "scoped", applyToShopify: "scoped",
  }),
  field({
    key: "mediaAlt", contractKey: "media.alt", label: "Photo alt",
    scope: "base", section: "media", ownership: "shopify", valueType: "string",
    normalizerId: "media-gallery-identity", windowPaths: [],
    applyToSynarava: "scoped", applyToShopify: "scoped",
  }),
  field({
    key: "publications", label: "Publications", scope: "base", section: "essentials",
    ownership: "shopify", valueType: "list", normalizerId: "publications",
    windowPaths: ["publications"], applyToSynarava: "unsupported", applyToShopify: "unsupported",
  }),
  field({
    key: "options", label: "Options", scope: "base", section: "essentials",
    ownership: "shopify", valueType: "list", normalizerId: "product-options",
    windowPaths: ["options"], applyToSynarava: "whole-record-only", applyToShopify: "whole-record-only",
  }),
  field({
    key: "collections", label: "Collections", scope: "base", section: "essentials",
    ownership: "shopify", valueType: "list", normalizerId: "collection-membership",
    windowPaths: ["collections"], applyToSynarava: "whole-record-only", applyToShopify: "whole-record-only",
  }),
  field({
    key: "metafields", label: "Metafields", scope: "base", section: "metafields",
    ownership: "shopify", valueType: "json", normalizerId: "metafield-map",
    windowPaths: ["metafields"], applyToSynarava: "whole-record-only", applyToShopify: "whole-record-only",
  }),
  field({
    key: "sku", label: "Variant SKU", scope: "base", section: "inventory",
    ownership: "shopify", valueType: "string", normalizerId: "trim-string",
    windowPaths: ["variants[].sku"], applyToSynarava: "scoped", applyToShopify: "scoped",
  }),
  field({
    key: "price", label: "Price", scope: "base", section: "price",
    ownership: "shopify", valueType: "money", normalizerId: "money-amount",
    windowPaths: ["variants[].price"], applyToSynarava: "scoped", applyToShopify: "scoped",
  }),
  field({
    key: "compareAtPrice", label: "Compare-at price", scope: "base", section: "price",
    ownership: "shopify", valueType: "money", normalizerId: "money-amount",
    windowPaths: ["variants[].compareAtPrice"], applyToSynarava: "scoped", applyToShopify: "scoped",
  }),
  field({
    key: "taxable", label: "Charge tax", scope: "base", section: "price",
    ownership: "shopify", valueType: "boolean", normalizerId: "boolean",
    windowPaths: ["variants[].taxable"], applyToSynarava: "scoped", applyToShopify: "scoped",
  }),
  field({
    key: "inventoryQuantity", label: "Available quantity", scope: "base", section: "inventory",
    ownership: "shopify", valueType: "number", normalizerId: "integer",
    windowPaths: ["variants[].inventoryQuantity", "totalInventory"],
    applyToSynarava: "whole-record-only", applyToShopify: "whole-record-only",
  }),
  field({
    key: "barcode", label: "Barcode", scope: "base", section: "inventory",
    ownership: "shopify", valueType: "string", normalizerId: "trim-string",
    windowPaths: ["variants[].barcode"], applyToSynarava: "whole-record-only", applyToShopify: "whole-record-only",
  }),
  field({
    key: "inventoryPolicy", label: "Inventory policy", scope: "base", section: "inventory",
    ownership: "shopify", valueType: "enum", normalizerId: "inventory-policy",
    windowPaths: ["variants[].inventoryPolicy"], applyToSynarava: "whole-record-only", applyToShopify: "whole-record-only",
  }),
  field({
    key: "selectedOptions", label: "Selected options", scope: "base", section: "essentials",
    ownership: "shopify", valueType: "list", normalizerId: "selected-options",
    windowPaths: ["variants[].selectedOptions"], applyToSynarava: "whole-record-only", applyToShopify: "whole-record-only",
  }),
  field({
    key: "inventoryItemId", label: "Inventory item", scope: "base", section: "inventory",
    ownership: "shopify", valueType: "identity", normalizerId: "gid",
    windowPaths: ["variants[].inventoryItem.id"], applyToSynarava: "unsupported", applyToShopify: "unsupported",
  }),
  field({
    key: "requiresShipping", label: "Requires shipping", scope: "base", section: "inventory",
    ownership: "shopify", valueType: "boolean", normalizerId: "boolean",
    windowPaths: ["variants[].inventoryItem.requiresShipping"],
    applyToSynarava: "whole-record-only", applyToShopify: "whole-record-only",
  }),
  field({
    key: "tracked", label: "Track quantity", scope: "base", section: "inventory",
    ownership: "shopify", valueType: "boolean", normalizerId: "boolean",
    windowPaths: ["variants[].inventoryItem.tracked"],
    applyToSynarava: "whole-record-only", applyToShopify: "whole-record-only",
  }),
  field({
    key: "unitCost", label: "Cost", scope: "base", section: "price",
    ownership: "shopify", valueType: "money", normalizerId: "money-object",
    windowPaths: ["variants[].inventoryItem.unitCost"],
    applyToSynarava: "whole-record-only", applyToShopify: "whole-record-only",
  }),
  field({
    key: "countryCodeOfOrigin", label: "Country of origin", scope: "base", section: "inventory",
    ownership: "shopify", valueType: "string", normalizerId: "country-code",
    windowPaths: ["variants[].inventoryItem.countryCodeOfOrigin"],
    applyToSynarava: "whole-record-only", applyToShopify: "whole-record-only",
  }),
  field({
    key: "harmonizedSystemCode", label: "HS code", scope: "base", section: "inventory",
    ownership: "shopify", valueType: "string", normalizerId: "trim-string",
    windowPaths: ["variants[].inventoryItem.harmonizedSystemCode"],
    applyToSynarava: "whole-record-only", applyToShopify: "whole-record-only",
  }),
  field({
    key: "measurementWeight", label: "Weight", scope: "base", section: "inventory",
    ownership: "shopify", valueType: "weight", normalizerId: "weight-grams",
    windowPaths: [
      "variants[].inventoryItem.measurement",
      "variants[].inventoryItem.measurement.weight",
    ],
    applyToSynarava: "whole-record-only", applyToShopify: "whole-record-only",
  }),
  // synaravaOnly — never in commerce window / never conflicts
  field({
    key: "passport", label: "Synarava Passport", scope: "synaravaOnly", section: "passport",
    ownership: "synarava", valueType: "json", normalizerId: "passthrough",
    windowPaths: [], applyToSynarava: "unsupported", applyToShopify: "unsupported",
  }),
  field({
    key: "note", label: "Note", scope: "synaravaOnly", section: "details",
    ownership: "synarava", valueType: "string", normalizerId: "passthrough",
    windowPaths: [], applyToSynarava: "unsupported", applyToShopify: "unsupported",
  }),
] as const;

export const COLLECTION_COMMERCE_FIELDS: readonly SyncFieldDef[] = [
  field({
    key: "title", contractKey: "collection.title", label: "Name", scope: "locale", section: "essentials",
    ownership: "shared", valueType: "string", normalizerId: "trim-string",
    windowPaths: ["title"], applyToSynarava: "scoped", applyToShopify: "scoped",
  }),
  field({
    key: "handle", contractKey: "collection.handle", label: "Handle", scope: "locale", section: "essentials",
    ownership: "shared", valueType: "string", normalizerId: "handle",
    windowPaths: ["handle"], applyToSynarava: "scoped", applyToShopify: "scoped",
  }),
  field({
    key: "descriptionHtml", contractKey: "collection.descriptionHtml", label: "Description",
    scope: "locale", section: "essentials", ownership: "shared", valueType: "html",
    normalizerId: "sanitize-html", windowPaths: ["descriptionHtml"],
    applyToSynarava: "scoped", applyToShopify: "scoped",
  }),
  field({
    key: "seoTitle", contractKey: "collection.seoTitle", label: "SEO title", scope: "locale",
    section: "essentials", ownership: "shared", valueType: "string", normalizerId: "trim-string",
    windowPaths: ["seo.title"], applyToSynarava: "scoped", applyToShopify: "scoped",
  }),
  field({
    key: "seoDescription", contractKey: "collection.seoDescription", label: "SEO description",
    scope: "locale", section: "essentials", ownership: "shared", valueType: "string",
    normalizerId: "trim-string", windowPaths: ["seo.description"],
    applyToSynarava: "scoped", applyToShopify: "scoped",
  }),
] as const;

/** Synthetic contract keys (not Shopify window paths). */
export const PRESENCE_CONTRACT_KEY = "presence";
export const WHOLE_ITEM_CONTRACT_KEY = "commerce:whole-item";
export const ADOPT_CONTRACT_KEY = "adopt-shopify";
export const UNMAPPED_CONTRACT_KEY = "unmapped";

/**
 * Technical noise omitted from commerce compare / coverage (denylist).
 * Keep in sync with `TECHNICAL_KEYS` / `shouldOmitKey` in shopify-projection-diff.
 */
export const TECHNICAL_COMPARE_KEYS = [
  "pageInfo",
  "hasNextPage",
  "endCursor",
  "updatedAt",
  "__typename",
  "metafieldTranslations",
  "inventoryLevels",
  // GraphQL connection wrappers / ids that are not commerce identity leaves
  "id",
  "featuredMedia",
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

/** Normalize concrete deepDiff paths (`variants[0].x`) to registry patterns (`variants[].x`). */
export function normalizeWindowPath(path: string): string {
  return path.replace(/\[\d+\]/g, "[]");
}

/**
 * Path-segment boundary match — nested paths under a registered root match
 * (`variants[].inventoryItem.unitCost.amount` → Cost), unlike the old
 * `startsWith(p.replace("[]",""))` which never matched `[]` patterns.
 */
export function pathMatchesWindowPattern(path: string, pattern: string): boolean {
  const normalized = normalizeWindowPath(path);
  if (normalized === pattern) return true;
  if (normalized.startsWith(`${pattern}.`)) return true;
  if (normalized.startsWith(`${pattern}[`)) return true;
  return false;
}

function longestMatchingField(
  fields: readonly SyncFieldDef[],
  path: string,
): SyncFieldDef | null {
  let best: SyncFieldDef | null = null;
  let bestLen = -1;
  for (const fieldDef of fields) {
    for (const pattern of fieldDef.windowPaths) {
      if (!pathMatchesWindowPattern(path, pattern)) continue;
      if (pattern.length > bestLen) {
        best = fieldDef;
        bestLen = pattern.length;
      }
    }
  }
  return best;
}

/** Lookup the contract entry for a Shopify-shaped window path (product then collection). */
export function lookupContractForPath(path: string): SyncFieldDef | null {
  return longestMatchingField(PRODUCT_COMMERCE_FIELDS, path)
    ?? longestMatchingField(COLLECTION_COMMERCE_FIELDS, path);
}

export function lookupContractByKey(contractKey: string): SyncFieldDef | null {
  return PRODUCT_COMMERCE_FIELDS.find((f) => f.contractKey === contractKey)
    ?? COLLECTION_COMMERCE_FIELDS.find((f) => f.contractKey === contractKey)
    ?? null;
}

/**
 * Human label for a window path. Returns null when the path is not in the
 * contract (callers must emit an Unmapped blocked leaf — no last-segment fallback).
 */
export function labelForWindowPathOrNull(path: string): string | null {
  return lookupContractForPath(path)?.label ?? null;
}

/**
 * Label for a registered path. Unmapped paths return a blocked-leaf title
 * (`Unmapped Shopify field <path>`) — never a friendly last-segment guess.
 */
export function labelForWindowPath(path: string): string {
  return labelForWindowPathOrNull(path) ?? `Unmapped Shopify field ${path}`;
}

export function sectionForWindowPath(path: string): SyncConflictSection {
  return lookupContractForPath(path)?.section ?? "shopify";
}

export function contractKeyForWindowPath(path: string): string {
  return lookupContractForPath(path)?.contractKey ?? UNMAPPED_CONTRACT_KEY;
}

export function isUnmappedWindowPath(path: string): boolean {
  return lookupContractForPath(path) == null;
}

/** Whole-item / leaf part payload carried on `commerce:whole-item` SyncLeaves. */
export type SyncLeafPart = {
  contractKey: string;
  path: string;
  label: string;
  section: SyncConflictSection;
  local: string;
  shopify: string;
};
