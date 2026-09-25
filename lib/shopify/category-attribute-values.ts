import type { ProductCharacteristicKey } from "@/lib/products/characteristics";

export type ShopifyCategoryAttributeSelection = {
  key: string;
  label: string;
  values: string[];
};

type SnapshotMetafield = {
  namespace?: unknown;
  key?: unknown;
  type?: unknown;
  value?: unknown;
  resolvedValues?: unknown;
  definition?: unknown;
};

/** Shopify category metafields use taxonomy-value or metaobject references. */
export function isShopifyCategoryMetafieldType(type: string): boolean {
  return type.includes("product_taxonomy_value_reference") || type.includes("metaobject_reference");
}

function definitionName(definition: unknown): string {
  if (definition == null || typeof definition !== "object" || Array.isArray(definition)) return "";
  const name = (definition as { name?: unknown }).name;
  return typeof name === "string" ? name.trim() : "";
}

function resolvedNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((entry): entry is string => typeof entry === "string" && Boolean(entry.trim())))];
}

/**
 * Selected Shopify category attribute values from a stored product snapshot.
 * Prefers resolved display names; never returns the category's full vocabulary.
 */
export function extractSelectedShopifyCategoryAttributes(
  snapshot: unknown,
): ShopifyCategoryAttributeSelection[] {
  if (snapshot == null || typeof snapshot !== "object" || Array.isArray(snapshot)) return [];
  const metafields = (snapshot as { metafields?: unknown }).metafields;
  if (!Array.isArray(metafields)) return [];

  return metafields.flatMap((item) => {
    const field = item as SnapshotMetafield;
    if (field.namespace !== "shopify" || typeof field.key !== "string" || typeof field.type !== "string") {
      return [];
    }
    if (!isShopifyCategoryMetafieldType(field.type)) return [];
    const values = resolvedNames(field.resolvedValues);
    if (!values.length) return [];
    const label = definitionName(field.definition) || field.key.replace(/-/g, " ");
    return [{ key: field.key, label, values }];
  });
}

/** Known Shopify category metafield keys → Synarava passport characteristics. */
const KEY_TO_CHARACTERISTIC: Record<string, ProductCharacteristicKey> = {
  "color-pattern": "color",
  color: "color",
  fabric: "material",
  material: "material",
  metal: "metal",
  size: "size",
  "clothing-size": "size",
  "age-group": "recommended_age",
  gemstone: "stone_type",
  stone: "stone_type",
  finish: "finish",
  plating: "plating",
};

const LABEL_TO_CHARACTERISTIC: Record<string, ProductCharacteristicKey> = {
  color: "color",
  material: "material",
  fabric: "material",
  metal: "metal",
  size: "size",
  "age group": "recommended_age",
  gemstone: "stone_type",
  stone: "stone_type",
  finish: "finish",
  plating: "plating",
};

/**
 * Maps a Shopify category metafield onto a Synarava TEXT characteristic when
 * the attribute is a known passport fact. Unmapped attributes stay snapshot-
 * only (shown in admin mirror / Additional details) and are not forced into
 * the passport schema.
 */
export function characteristicKeyForShopifyCategoryMetafield(
  key: string,
  label?: string | null,
): ProductCharacteristicKey | null {
  const fromKey = KEY_TO_CHARACTERISTIC[key.trim().toLowerCase()];
  if (fromKey) return fromKey;
  const normalizedLabel = label?.trim().toLowerCase() ?? "";
  return LABEL_TO_CHARACTERISTIC[normalizedLabel] ?? null;
}

/** Human-readable names from a TaxonomyValue or category Metaobject node. */
export function displayNamesFromCategoryReference(node: {
  name?: string | null;
  displayName?: string | null;
  fields?: Array<{ key?: string | null; value?: string | null }> | null;
}): string[] {
  const taxonomyName = node.name?.trim();
  if (taxonomyName) return [taxonomyName];

  const displayName = node.displayName?.trim();
  if (displayName) return [displayName];

  const label = node.fields?.find((field) => field.key === "label")?.value?.trim();
  if (label) return [label];

  return [];
}
