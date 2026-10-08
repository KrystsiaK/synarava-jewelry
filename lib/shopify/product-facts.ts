import {
  characteristicDisplayValue,
  characteristicUnit,
  resolveCharacteristicDisplayValue,
  type ProductCharacteristicValue,
} from "@/lib/products/characteristics";
import { localizeShopFacetValue } from "@/lib/catalog/shop-facet-labels";
import type { Locale } from "@/lib/i18n/locales";
import {
  characteristicKeyForShopifyCategoryMetafield,
  extractSelectedShopifyCategoryAttributes,
  isShopifyCategoryMetafieldType,
} from "@/lib/shopify/category-attribute-values";
import { coerceMetafieldRows } from "@/lib/shopify/product-metafields-shared";

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
 * Localize a pulled EN display value: passport TEXT overlay → taxonomy/code map → EN.
 * Used by Last Pull panel and related admin previews — not a Shopify translation push.
 */
export function localizePulledFactValue(input: {
  value: string;
  locale: Locale;
  characteristicKey?: string | null;
  characteristicTextOverlay?: Record<string, string>;
  taxonomyOverlays?: Map<string, string> | null;
}): string {
  const trimmed = input.value.trim();
  if (!trimmed || input.locale === "en") return trimmed;

  const overlayKey = input.characteristicKey?.trim();
  if (overlayKey) {
    const overlay = input.characteristicTextOverlay?.[overlayKey]?.trim();
    if (overlay) return overlay;
  }

  if (trimmed.includes(",")) {
    return trimmed
      .split(",")
      .map((part) => localizeShopFacetValue(part.trim(), input.locale, input.taxonomyOverlays))
      .join(", ");
  }

  return localizeShopFacetValue(trimmed, input.locale, input.taxonomyOverlays);
}

function localizeCategoryPath(
  fullName: string,
  locale: Locale,
  taxonomyOverlays?: Map<string, string> | null,
): string {
  if (locale === "en") return fullName;
  const parts = fullName.split(">").map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) return fullName;
  const leaf = parts[parts.length - 1]!;
  const localizedLeaf = localizeShopFacetValue(leaf, locale, taxonomyOverlays);
  if (localizedLeaf === leaf) return fullName;
  return [...parts.slice(0, -1), localizedLeaf].join(" > ");
}

/**
 * Customer-facing product facts projected from the last Shopify snapshot
 * (and already-seeded passport rows). This is the Catalog source of truth —
 * not the fixed Synarava jewelry checklist.
 *
 * Non-EN `locale` applies Synarava overlays (passport TEXT + taxonomy map)
 * for display only — EN Shopify pull remains the identity source.
 */
export function extractShopifyProductFacts(input: {
  snapshot?: unknown;
  shopifyCategoryName?: string | null;
  vendor?: string | null;
  productType?: string | null;
  characteristics?: ProductCharacteristicValue[];
  locale?: Locale;
  characteristicTextOverlay?: Record<string, string>;
  taxonomyOverlays?: Map<string, string> | null;
}): ShopifyProductFact[] {
  const facts: ShopifyProductFact[] = [];
  const seenLabels = new Set<string>();
  const locale = input.locale ?? "en";
  const textOverlay = input.characteristicTextOverlay ?? {};
  const taxonomyOverlays = input.taxonomyOverlays ?? null;

  function pushRaw(key: string, label: string, value: string) {
    const trimmedLabel = label.trim();
    const trimmedValue = value.trim();
    if (!trimmedLabel || !trimmedValue) return;
    const dedupe = trimmedLabel.toLowerCase();
    if (seenLabels.has(dedupe)) return;
    seenLabels.add(dedupe);
    facts.push({ key, label: trimmedLabel, value: trimmedValue });
  }

  function push(key: string, label: string, value: string, characteristicKey?: string | null) {
    pushRaw(
      key,
      label,
      localizePulledFactValue({
        value,
        locale,
        characteristicKey,
        characteristicTextOverlay: textOverlay,
        taxonomyOverlays,
      }),
    );
  }

  if (input.shopifyCategoryName?.trim()) {
    pushRaw(
      "category",
      "Category",
      localizeCategoryPath(input.shopifyCategoryName.trim(), locale, taxonomyOverlays),
    );
  }
  if (input.vendor?.trim()) {
    pushRaw("vendor", "Vendor", input.vendor.trim());
  }
  if (input.productType?.trim()) {
    push(
      "productType",
      "Product type",
      input.productType.trim(),
    );
  }

  for (const attribute of extractSelectedShopifyCategoryAttributes(input.snapshot)) {
    const characteristicKey = characteristicKeyForShopifyCategoryMetafield(
      attribute.key,
      attribute.label,
    );
    push(`category:${attribute.key}`, attribute.label, attribute.values.join(", "), characteristicKey);
  }

  const snapshot = record(input.snapshot);
  const metafields = coerceMetafieldRows(snapshot.metafields);
  for (const item of metafields) {
    const field = item as SnapshotMetafield;
    if (typeof field.namespace !== "string" || SKIP_METAFIELD_NAMESPACES.has(field.namespace)) continue;
    if (typeof field.key !== "string" || typeof field.type !== "string") continue;
    if (field.namespace === "shopify" && isShopifyCategoryMetafieldType(field.type)) continue;

    const label = definitionName(field.definition) || field.key.replace(/[_-]/g, " ");
    // Prefer storefront-public merchant facts; still show custom text when access is unset.
    const access = storefrontAccess(field.definition);
    if (access === "NONE") continue;

    const characteristicKey = characteristicKeyForShopifyCategoryMetafield(field.key, label);

    if (isShopifyCategoryMetafieldType(field.type)) {
      const resolved = Array.isArray(field.resolvedValues)
        ? field.resolvedValues.filter((entry): entry is string => typeof entry === "string" && Boolean(entry.trim()))
        : [];
      if (resolved.length) {
        push(`${field.namespace}.${field.key}`, label, resolved.join(", "), characteristicKey);
      }
      continue;
    }

    if (!SIMPLE_TEXT_TYPES.has(field.type) || typeof field.value !== "string") continue;
    const value = field.type === "boolean"
      ? field.value === "true" ? "Yes" : "No"
      : field.value.trim();
    if (value) push(`${field.namespace}.${field.key}`, label, value, characteristicKey);
  }

  const variants = rows(snapshot.variants);
  const primary = variants[0] ?? {};
  const inventoryItem = record(primary.inventoryItem);
  const weight = record(record(inventoryItem.measurement).weight);
  if (typeof weight.value === "number" && Number.isFinite(weight.value)) {
    const unitRaw = typeof weight.unit === "string" ? weight.unit.toLowerCase().replace(/s$/, "") : "g";
    const unitCode = unitRaw === "gram" ? "g" : unitRaw;
    const unit = characteristicUnit(unitCode, locale) || unitCode;
    pushRaw("weight", "Unit weight", `${weight.value} ${unit}`);
  }
  if (typeof inventoryItem.countryCodeOfOrigin === "string" && inventoryItem.countryCodeOfOrigin.trim()) {
    push("origin", "Country of origin", inventoryItem.countryCodeOfOrigin.trim(), "origin");
  }

  // Passport rows already seeded from Shopify (e.g. after Pull) fill any remaining gaps.
  for (const characteristic of input.characteristics ?? []) {
    const display = resolveCharacteristicDisplayValue(characteristic, locale, textOverlay).trim()
      || characteristicDisplayValue(characteristic, locale).trim();
    if (!display) continue;
    pushRaw(`characteristic:${characteristic.key}`, characteristic.label, display);
  }

  return facts;
}
