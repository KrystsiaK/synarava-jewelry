import { characteristicDisplayValue, type ProductCharacteristicValue } from "@/lib/products/characteristics";
import {
  extractSelectedShopifyCategoryAttributes,
  isShopifyCategoryMetafieldType,
} from "@/lib/shopify/category-attribute-values";

export type ShopifyProductFact = {
  key: string;
  label: string;
  value: string;
};

type SnapshotMetafield = {
  namespace?: unknown;
  key?: unknown;
  type?: unknown;
  value?: unknown;
  resolvedValues?: unknown;
  definition?: unknown;
};

function record(value: unknown): Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function rows(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(record) : [];
}

function definitionName(definition: unknown): string {
  if (definition == null || typeof definition !== "object" || Array.isArray(definition)) return "";
  const name = (definition as { name?: unknown }).name;
  return typeof name === "string" ? name.trim() : "";
}

function storefrontAccess(definition: unknown): string | null {
  const access = record(record(definition).access).storefront;
  return typeof access === "string" ? access : null;
}

const SKIP_METAFIELD_NAMESPACES = new Set(["global", "synarava"]);
const SIMPLE_TEXT_TYPES = new Set(["single_line_text_field", "multi_line_text_field", "string", "boolean", "number_integer", "number_decimal", "url"]);

/**
 * Customer-facing product facts projected from the last Shopify snapshot
 * (and already-seeded passport rows). This is the Catalog source of truth —
 * not the fixed Synarava jewelry checklist.
 */
export function extractShopifyProductFacts(input: {
  snapshot?: unknown;
  shopifyCategoryName?: string | null;
  vendor?: string | null;
  productType?: string | null;
  characteristics?: ProductCharacteristicValue[];
}): ShopifyProductFact[] {
  const facts: ShopifyProductFact[] = [];
  const seenLabels = new Set<string>();

  function push(key: string, label: string, value: string) {
    const trimmedLabel = label.trim();
    const trimmedValue = value.trim();
    if (!trimmedLabel || !trimmedValue) return;
    const dedupe = trimmedLabel.toLowerCase();
    if (seenLabels.has(dedupe)) return;
    seenLabels.add(dedupe);
    facts.push({ key, label: trimmedLabel, value: trimmedValue });
  }

  if (input.shopifyCategoryName?.trim()) {
    push("category", "Category", input.shopifyCategoryName.trim());
  }
  if (input.vendor?.trim()) {
    push("vendor", "Vendor", input.vendor.trim());
  }
  if (input.productType?.trim()) {
    push("productType", "Product type", input.productType.trim());
  }

  for (const attribute of extractSelectedShopifyCategoryAttributes(input.snapshot)) {
    push(`category:${attribute.key}`, attribute.label, attribute.values.join(", "));
  }

  const snapshot = record(input.snapshot);
  const metafields = Array.isArray(snapshot.metafields) ? snapshot.metafields : [];
  for (const item of metafields) {
    const field = item as SnapshotMetafield;
    if (typeof field.namespace !== "string" || SKIP_METAFIELD_NAMESPACES.has(field.namespace)) continue;
    if (typeof field.key !== "string" || typeof field.type !== "string") continue;
    if (field.namespace === "shopify" && isShopifyCategoryMetafieldType(field.type)) continue;

    const label = definitionName(field.definition) || field.key.replace(/[_-]/g, " ");
    // Prefer storefront-public merchant facts; still show custom text when access is unset.
    const access = storefrontAccess(field.definition);
    if (access === "NONE") continue;

    if (isShopifyCategoryMetafieldType(field.type)) {
      const resolved = Array.isArray(field.resolvedValues)
        ? field.resolvedValues.filter((entry): entry is string => typeof entry === "string" && Boolean(entry.trim()))
        : [];
      if (resolved.length) push(`${field.namespace}.${field.key}`, label, resolved.join(", "));
      continue;
    }

    if (!SIMPLE_TEXT_TYPES.has(field.type) || typeof field.value !== "string") continue;
    const value = field.type === "boolean"
      ? field.value === "true" ? "Yes" : "No"
      : field.value.trim();
    if (value) push(`${field.namespace}.${field.key}`, label, value);
  }

  const variants = rows(snapshot.variants);
  const primary = variants[0] ?? {};
  const inventoryItem = record(primary.inventoryItem);
  const weight = record(record(inventoryItem.measurement).weight);
  if (typeof weight.value === "number" && Number.isFinite(weight.value)) {
    const unit = typeof weight.unit === "string" ? weight.unit.toLowerCase().replace(/s$/, "") : "g";
    push("weight", "Unit weight", `${weight.value} ${unit === "gram" ? "g" : unit}`);
  }
  if (typeof inventoryItem.countryCodeOfOrigin === "string" && inventoryItem.countryCodeOfOrigin.trim()) {
    push("origin", "Country of origin", inventoryItem.countryCodeOfOrigin.trim());
  }

  // Passport rows already seeded from Shopify (e.g. after Pull) fill any remaining gaps.
  for (const characteristic of input.characteristics ?? []) {
    const display = characteristicDisplayValue(characteristic).trim();
    if (!display) continue;
    push(`characteristic:${characteristic.key}`, characteristic.label, display);
  }

  return facts;
}
