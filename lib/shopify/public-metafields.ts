import { PRODUCT_CHARACTERISTICS } from "@/lib/products/characteristics";
import { localizeShopFacetValue } from "@/lib/catalog/shop-facet-labels";
import type { Locale } from "@/lib/i18n/locales";
import {
  characteristicKeyForShopifyCategoryMetafield,
  isShopifyCategoryMetafieldType,
} from "@/lib/shopify/category-attribute-values";
import {
  coerceMetafieldRows,
  isTranslatableMetafieldType,
  metafieldIdentityKey,
  metafieldTranslationsFromSnapshot,
} from "@/lib/shopify/product-metafields-shared";

const SUPPORTED_TYPES = new Set([
  "single_line_text_field", "multi_line_text_field", "number_integer",
  "number_decimal", "boolean", "date", "date_time", "url",
]);
const MANAGED_KEYS = new Set<string>(PRODUCT_CHARACTERISTICS.map((item) => item.key));

function record(value: unknown): Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function localizePublicFactValue(input: {
  value: string;
  locale: Locale;
  characteristicKey?: string | null;
  characteristicTextOverlay?: Record<string, string>;
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
      .map((part) => localizeShopFacetValue(part.trim(), input.locale))
      .join(", ");
  }

  return localizeShopFacetValue(trimmed, input.locale);
}

/** Only Shopify definitions explicitly readable from Storefront may become product copy. */
export function projectPublicProductMetafields(
  value: unknown,
  options?: {
    locale?: string;
    snapshot?: unknown;
    /** Synarava Passport TEXT overlays — display only; never pushed as Shopify translations. */
    characteristicTextOverlay?: Record<string, string>;
  },
): Array<{ label: string; value: string }> {
  const locale = (options?.locale ?? "en") as Locale;
  const translations = metafieldTranslationsFromSnapshot(options?.snapshot ?? value);
  const localeBucket = locale !== "en" ? translations[locale] ?? {} : {};
  const passportOverlay = options?.characteristicTextOverlay ?? {};

  return coerceMetafieldRows(value).flatMap((item) => {
    const field = record(item);
    const definition = record(field.definition);
    const label = typeof definition.name === "string" && definition.name.trim()
      ? definition.name.trim()
      : typeof field.key === "string" ? field.key.replace(/_/g, " ") : "";
    const characteristicKey = typeof field.key === "string"
      ? characteristicKeyForShopifyCategoryMetafield(field.key, label)
      : null;

    if (
      field.namespace === "shopify"
      && typeof field.type === "string"
      && isShopifyCategoryMetafieldType(field.type)
    ) {
      const resolvedValues = Array.isArray(field.resolvedValues)
        ? field.resolvedValues.filter((entry): entry is string => typeof entry === "string" && Boolean(entry.trim()))
        : [];
      if (!label || !resolvedValues.length) return [];
      const valueText = localizePublicFactValue({
        value: resolvedValues.join(", "),
        locale,
        characteristicKey,
        characteristicTextOverlay: passportOverlay,
      });
      return valueText ? [{ label, value: valueText }] : [];
    }
    if (record(definition.access).storefront !== "PUBLIC_READ") return [];
    if (typeof field.key !== "string" || typeof field.type !== "string" || typeof field.value !== "string") return [];
    if (!SUPPORTED_TYPES.has(field.type)) return [];
    if (field.namespace === "synarava" && MANAGED_KEYS.has(field.key)) return [];
    const sourceValue = field.type === "boolean" ? field.value === "true" ? "Yes" : "No" : field.value.trim();
    const shopifyTranslated = typeof field.namespace === "string" && isTranslatableMetafieldType(field.type)
      ? localeBucket[metafieldIdentityKey(field.namespace, field.key)]?.trim()
      : "";
    const valueText = shopifyTranslated
      || localizePublicFactValue({
        value: sourceValue,
        locale,
        characteristicKey,
        characteristicTextOverlay: passportOverlay,
      });
    return valueText ? [{ label, value: valueText }] : [];
  });
}
