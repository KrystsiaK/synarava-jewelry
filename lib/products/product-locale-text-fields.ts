import { characteristicFormKey, PASSPORT_CHARACTERISTIC_TEXT_KEYS } from "@/lib/products/characteristics";
import { SHOPIFY_PRODUCT_SPEC_FIELDS } from "@/lib/products/shopify-product-specs";
import {
  CUSTOM_METAFIELD_VALUE_PREFIX,
  isTranslatableMetafieldType,
} from "@/lib/shopify/product-metafields-shared";
import { isShopifyCategoryMetafieldType } from "@/lib/shopify/category-attribute-values";

/**
 * Single inventory of product locale-tab free-text fields for Save + AI.
 * Save (`readProductTranslationFields` / details / specs overlays) and AI
 * generate / preview / Apply must share this list — never a parallel hardcode.
 *
 * Taxonomy / metaobject reference values are marked `translationMode: "taxonomy"`
 * and are never sent to the model (use TaxonomyValueLabel / existing overlays).
 */

export type ProductLocaleTextSection = "product" | "details" | "specs";

export type ProductLocaleTextTranslationMode = "model" | "taxonomy";

export type ProductLocaleTextFieldDef = {
  key: string;
  label: string;
  section: ProductLocaleTextSection;
  translationMode: ProductLocaleTextTranslationMode;
  kind: "plain" | "rich";
};

/** Flat ProductTranslation columns (same keys FormData / adminLocaleFieldName use). */
export const PRODUCT_CORE_TRANSLATABLE_FIELDS = [
  "title",
  "shortDescription",
  "description",
  "materialLine",
  "symbolismLabel",
  "symbolismTitle",
  "symbolismBody",
  "symbolismBody2",
  "seoTitle",
  "seoDescription",
] as const;

export type ProductCoreTranslatableField = (typeof PRODUCT_CORE_TRANSLATABLE_FIELDS)[number];

const CORE_LABELS: Record<ProductCoreTranslatableField, string> = {
  title: "Title",
  shortDescription: "Short description",
  description: "Description",
  materialLine: "Material line",
  symbolismLabel: "Symbolism — eyebrow",
  symbolismTitle: "Symbolism — title",
  symbolismBody: "Symbolism — body",
  symbolismBody2: "Symbolism — body (cont.)",
  seoTitle: "SEO title",
  seoDescription: "SEO description",
};

const CORE_RICH = new Set<string>([
  "shortDescription",
  "description",
  "symbolismBody",
  "symbolismBody2",
  "seoDescription",
]);

/** Slot counts must match `readProductTranslationDetails` / HiddenDetailsLocaleFields. */
export const PRODUCT_DETAILS_MATERIAL_SLOTS = 3;
export const PRODUCT_DETAILS_PROCESS_STAT_SLOTS = 4;
export const PRODUCT_DETAILS_LOOKBOOK_SLOTS = 4;

function buildDetailsFields(): ProductLocaleTextFieldDef[] {
  const fields: ProductLocaleTextFieldDef[] = [
    { key: "materialsEyebrow", label: "Materials — eyebrow", section: "details", translationMode: "model", kind: "plain" },
    { key: "materialsTitle", label: "Materials — title", section: "details", translationMode: "model", kind: "plain" },
  ];
  for (let index = 1; index <= PRODUCT_DETAILS_MATERIAL_SLOTS; index += 1) {
    fields.push(
      { key: `materialTitle${index}`, label: `Material ${index} — title`, section: "details", translationMode: "model", kind: "plain" },
      { key: `materialBody${index}`, label: `Material ${index} — body`, section: "details", translationMode: "model", kind: "rich" },
    );
  }
  fields.push(
    { key: "processEyebrow", label: "Process — eyebrow", section: "details", translationMode: "model", kind: "plain" },
    { key: "processTitle", label: "Process — title", section: "details", translationMode: "model", kind: "plain" },
  );
  for (let index = 1; index <= PRODUCT_DETAILS_PROCESS_STAT_SLOTS; index += 1) {
    fields.push(
      { key: `processStatValue${index}`, label: `Process stat ${index} — value`, section: "details", translationMode: "model", kind: "plain" },
      { key: `processStatLabel${index}`, label: `Process stat ${index} — label`, section: "details", translationMode: "model", kind: "plain" },
    );
  }
  fields.push(
    { key: "lookbookEyebrow", label: "Lookbook — eyebrow", section: "details", translationMode: "model", kind: "plain" },
    { key: "lookbookTitle", label: "Lookbook — title", section: "details", translationMode: "model", kind: "plain" },
  );
  for (let index = 1; index <= PRODUCT_DETAILS_LOOKBOOK_SLOTS; index += 1) {
    fields.push({
      key: `lookbookLabel${index}`,
      label: `Lookbook ${index} — label`,
      section: "details",
      translationMode: "model",
      kind: "plain",
    });
  }
  for (const key of PASSPORT_CHARACTERISTIC_TEXT_KEYS) {
    fields.push({
      key: characteristicFormKey(key),
      label: `Passport — ${key}`,
      section: "details",
      translationMode: "model",
      kind: "plain",
    });
  }
  return fields;
}

/** Form / AI key for a Shopify Product-tab custom.* spec value. */
export function shopifySpecLocaleFieldKey(specKey: string): string {
  return `${CUSTOM_METAFIELD_VALUE_PREFIX}custom:${specKey}`;
}

export function shopifySpecKeyFromLocaleFieldKey(fieldKey: string): string | null {
  const prefix = `${CUSTOM_METAFIELD_VALUE_PREFIX}custom:`;
  if (!fieldKey.startsWith(prefix)) return null;
  return fieldKey.slice(prefix.length) || null;
}

function translationModeForMetafieldType(type: string): ProductLocaleTextTranslationMode {
  if (isShopifyCategoryMetafieldType(type)) return "taxonomy";
  if (isTranslatableMetafieldType(type)) return "model";
  // Unknown / non-text → do not send to the model.
  return "taxonomy";
}

function buildSpecFields(): ProductLocaleTextFieldDef[] {
  return SHOPIFY_PRODUCT_SPEC_FIELDS.map((spec) => ({
    key: shopifySpecLocaleFieldKey(spec.key),
    label: spec.label,
    section: "specs" as const,
    translationMode: translationModeForMetafieldType(spec.type),
    kind: spec.multiline || String(spec.type).includes("multi_line") || String(spec.type).includes("rich_text")
      ? ("rich" as const)
      : ("plain" as const),
  }));
}

function buildCoreFields(): ProductLocaleTextFieldDef[] {
  return PRODUCT_CORE_TRANSLATABLE_FIELDS.map((key) => ({
    key,
    label: CORE_LABELS[key],
    section: "product" as const,
    translationMode: "model" as const,
    kind: CORE_RICH.has(key) ? ("rich" as const) : ("plain" as const),
  }));
}

/** Canonical list — Save + AI. */
export const PRODUCT_LOCALE_TEXT_FIELDS: readonly ProductLocaleTextFieldDef[] = Object.freeze([
  ...buildCoreFields(),
  ...buildDetailsFields(),
  ...buildSpecFields(),
]);

export const PRODUCT_LOCALE_TEXT_FIELD_KEYS = PRODUCT_LOCALE_TEXT_FIELDS.map((field) => field.key);

export type ProductLocaleTextFieldKey = (typeof PRODUCT_LOCALE_TEXT_FIELD_KEYS)[number];

const FIELD_BY_KEY = new Map(PRODUCT_LOCALE_TEXT_FIELDS.map((field) => [field.key, field]));

export function getProductLocaleTextField(key: string): ProductLocaleTextFieldDef | undefined {
  return FIELD_BY_KEY.get(key);
}

export function isProductLocaleTextFieldKey(key: string): key is ProductLocaleTextFieldKey {
  return FIELD_BY_KEY.has(key);
}

/** Fields the model may generate / translate (excludes taxonomy references). */
export function modelTranslatableProductLocaleFields(): readonly ProductLocaleTextFieldDef[] {
  return PRODUCT_LOCALE_TEXT_FIELDS.filter((field) => field.translationMode === "model");
}

export function productLocaleTextFieldsForSection(
  section: ProductLocaleTextSection,
): readonly ProductLocaleTextFieldDef[] {
  return PRODUCT_LOCALE_TEXT_FIELDS.filter((field) => field.section === section);
}

/** Preview section headings (Product / Details / Specs). */
export const PRODUCT_LOCALE_TEXT_SECTION_LABELS: Record<ProductLocaleTextSection, string> = {
  product: "Product",
  details: "Details",
  specs: "Specs",
};
