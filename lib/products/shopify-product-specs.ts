import {
  isShopifyOwnedCharacteristicKey,
  SHOPIFY_OWNED_CHARACTERISTIC_KEYS,
} from "@/lib/products/characteristics";
import {
  customMetafieldTypeFieldName,
  customMetafieldValueFieldName,
  metafieldIdentityKey,
  metafieldValueFromSnapshot,
  metafieldsArrayFromSnapshot,
  type MetafieldTranslations,
} from "@/lib/shopify/product-metafields-shared";

export { isShopifyOwnedCharacteristicKey, SHOPIFY_OWNED_CHARACTERISTIC_KEYS };

/**
 * Shopify-owned product specs edited on Product (Shopify group).
 * Values live in `custom.*` metafields (Save → workingSnapshot → Push).
 * They must not appear as editable Passport rows.
 */
export const SHOPIFY_PRODUCT_SPEC_FIELDS = [
  {
    key: "material",
    label: "Primary material",
    type: "single_line_text_field",
    characteristicKey: "material",
    multiline: false,
  },
  {
    key: "care_instructions",
    label: "Care instructions",
    type: "multi_line_text_field",
    characteristicKey: "care_instructions",
    multiline: true,
  },
  {
    key: "finish",
    label: "Finish",
    type: "single_line_text_field",
    characteristicKey: "finish",
    multiline: false,
  },
  {
    key: "wrist_fit",
    label: "Wrist fit",
    type: "single_line_text_field",
    characteristicKey: "fit_notes",
    multiline: false,
  },
  {
    key: "color",
    label: "Color",
    type: "single_line_text_field",
    characteristicKey: "color",
    multiline: false,
  },
  {
    key: "metal",
    label: "Metal",
    type: "single_line_text_field",
    characteristicKey: "metal",
    multiline: false,
  },
  {
    key: "stone",
    label: "Stone / gem",
    type: "single_line_text_field",
    characteristicKey: "stone_type",
    multiline: false,
  },
  {
    key: "plating",
    label: "Plating",
    type: "single_line_text_field",
    characteristicKey: "plating",
    multiline: false,
  },
  {
    key: "size",
    label: "Size",
    type: "single_line_text_field",
    characteristicKey: "size",
    multiline: false,
  },
] as const;

export type ShopifyProductSpecField = (typeof SHOPIFY_PRODUCT_SPEC_FIELDS)[number];

const SPEC_CUSTOM_KEYS = new Set<string>(SHOPIFY_PRODUCT_SPEC_FIELDS.map((item) => item.key));

/** `custom.material` / `wrist_fit` etc. — Product-tab owned jewelry specs. */
export function isShopifyProductSpecCustomKey(key: string): boolean {
  return SPEC_CUSTOM_KEYS.has(key.trim().toLowerCase());
}

export function isShopifyProductSpecFormField(fieldName: string, locale = "en"): boolean {
  for (const spec of SHOPIFY_PRODUCT_SPEC_FIELDS) {
    if (fieldName === customMetafieldValueFieldName("custom", spec.key, locale)) return true;
    if (fieldName === customMetafieldTypeFieldName("custom", spec.key)) return true;
  }
  return false;
}

/** Read EN custom.* values for known Product-tab specs from a commerce snapshot. */
export function shopifyProductSpecValuesFromSnapshot(snapshot: unknown): Record<string, string> {
  const metafields = metafieldsArrayFromSnapshot(snapshot);
  const out: Record<string, string> = {};
  for (const spec of SHOPIFY_PRODUCT_SPEC_FIELDS) {
    out[spec.key] = metafieldValueFromSnapshot(metafields, "custom", spec.key);
  }
  return out;
}

/** Locale overlays for Product-tab specs from workingSnapshot.metafieldTranslations. */
export function shopifyProductSpecOverlaysFromTranslations(
  translations: MetafieldTranslations | undefined,
  locale: string,
): Record<string, string> {
  if (!translations || locale === "en") return {};
  const bucket = translations[locale] ?? {};
  const out: Record<string, string> = {};
  for (const spec of SHOPIFY_PRODUCT_SPEC_FIELDS) {
    const value = bucket[metafieldIdentityKey("custom", spec.key)]?.trim();
    if (value) out[spec.key] = value;
  }
  return out;
}

/**
 * Project Product-tab custom.* specs into ProductCharacteristic rows for PDP / filters.
 * Keeps Synarava storefront passport projection aligned with Shopify-owned edits.
 */
export function characteristicProjectionsFromShopifySpecs(
  specs: ReadonlyArray<{ key: string; value: string; type?: string }>,
  sortOrderStart = 0,
): Array<{
  key: string;
  label: string;
  group: string;
  valueType: "TEXT";
  textValue: string;
  numberValue: null;
  booleanValue: null;
  unit: null;
  certificateUrl: null;
  searchable: boolean;
  filterable: boolean;
  sortOrder: number;
}> {
  const byCharacteristic = new Map<string, (typeof SHOPIFY_PRODUCT_SPEC_FIELDS)[number]>();
  for (const spec of SHOPIFY_PRODUCT_SPEC_FIELDS) {
    byCharacteristic.set(spec.key, spec);
  }

  const rows: ReturnType<typeof characteristicProjectionsFromShopifySpecs> = [];
  let sortOrder = sortOrderStart;
  for (const item of specs) {
    const spec = byCharacteristic.get(item.key);
    if (!spec) continue;
    const textValue = item.value.trim();
    if (!textValue) continue;
    rows.push({
      key: spec.characteristicKey,
      label: spec.label,
      group: spec.characteristicKey === "care_instructions"
        ? "Care"
        : spec.characteristicKey === "size" || spec.characteristicKey === "fit_notes"
          ? "Dimensions & fit"
          : "Materials & construction",
      valueType: "TEXT",
      textValue,
      numberValue: null,
      booleanValue: null,
      unit: null,
      certificateUrl: null,
      searchable: true,
      filterable: spec.characteristicKey !== "care_instructions" && spec.characteristicKey !== "fit_notes",
      sortOrder: sortOrder++,
    });
  }
  return rows;
}
