import type { ProductEditorSection } from "@/components/admin/products/product-editor-tabs";
import { isCustomMetafieldFormField } from "@/lib/shopify/product-metafields-shared";

export const SOURCE_LOCALE = "en";

/** Soft chrome tint for the product editor's locale workspace shell. */
export function localeWorkspaceTone(locale: string): {
  background: string;
  border: string;
  accent: string;
} {
  const code = locale.toLowerCase();
  if (code === "pt") {
    return {
      background: "color-mix(in srgb, #5f7a5a 11%, var(--adm-panel))",
      border: "color-mix(in srgb, #5f7a5a 32%, var(--adm-border))",
      accent: "#5f7a5a",
    };
  }
  if (code === "ru") {
    return {
      background: "color-mix(in srgb, #5a6f8a 11%, var(--adm-panel))",
      border: "color-mix(in srgb, #5a6f8a 32%, var(--adm-border))",
      accent: "#5a6f8a",
    };
  }
  return {
    background: "color-mix(in srgb, var(--adm-accent) 11%, var(--adm-panel))",
    border: "color-mix(in srgb, var(--adm-accent) 32%, var(--adm-border))",
    accent: "var(--adm-accent)",
  };
}

/** One branch in the product → locale → section sync tree. */
export type ProductEditorBranch =
  | { level: "product" }
  | { level: "locale"; locale: string }
  | { level: "section"; locale: string; section: ProductEditorSection };

export type DirtyScopeKey = string;

export function sectionDirtyKey(locale: string, section: ProductEditorSection): DirtyScopeKey {
  return `${locale}:${section}`;
}

export function localeHasDirty(
  dirty: ReadonlySet<DirtyScopeKey>,
  locale: string,
  sections: readonly ProductEditorSection[],
): boolean {
  if (dirty.has("shared:*")) return true;
  for (const section of sections) {
    if (dirty.has(sectionDirtyKey(locale, section))) return true;
    if (isSharedSection(section) && dirty.has(sectionDirtyKey("*", section))) return true;
  }
  return false;
}

/** Catalog / metafields / media / shopify / price are shared across languages. */
export function isSharedSection(section: ProductEditorSection): boolean {
  return (
    section === "catalog"
    || section === "metafields"
    || section === "media"
    || section === "shopify"
    || section === "price"
  );
}

export function isLocaleSection(section: ProductEditorSection): boolean {
  return section === "essentials" || section === "details";
}

export function dirtyKeyForEdit(locale: string, section: ProductEditorSection): DirtyScopeKey {
  return isSharedSection(section) ? sectionDirtyKey("*", section) : sectionDirtyKey(locale, section);
}

const ALWAYS_FROM_CURRENT = new Set([
  "productId",
]);

/** Fields required by saveProductAction validation — always present from current or baseline. */
const REQUIRED_FIELDS = new Set(["name", "slug", "sku", "price", "stockOnHand", "workflowState"]);

const ESSENTIALS_SHARED = [
  "name", "slug", "vendor", "productType", "tags",
];
/** Shopify description + SEO + title/handle; reviewed flag rides with locale Product tab. */
const ESSENTIALS_LOCALE = [
  "title", "localizedHandle",
  "description", "seoTitle", "seoDescription", "reviewed",
];
/** compareAt + cost are Shopify-edit-only (AdminReadonlyField) — not in FormData / dirty scope. */
const PRICE_SHARED = ["price", "taxable"];
const MEDIA_SHARED = ["existingImageUrl", "removeImage", "imageFile"];
const CATALOG_SHARED = [
  "collectionSlug", "workflowState",
  "shopifyCategoryId", "shopifyCategoryName",
];
/** Parked on Sync until Inventory tab. */
const SHOPIFY_TAB_SHARED = ["sku", "stockOnHand"];
/** Synarava Product page copy (not Shopify description). */
const DETAILS_LOCALE = [
  "shortDescription", "materialLine",
  "symbolismLabel", "symbolismTitle", "symbolismBody", "symbolismBody2",
];
const DETAILS_LOCALE_PREFIXES = [
  "materialsEyebrow", "materialsTitle", "materialTitle", "materialBody",
  "processEyebrow", "processTitle", "processStatValue", "processStatLabel",
  "lookbookEyebrow", "lookbookTitle", "lookbookLabel",
];
const DETAILS_SHARED_PREFIXES = [
  "existingMaterialImage", "materialImageFile", "removeMaterialImage",
  "existingProcessMediaImage", "processMediaImageFile", "removeProcessMediaImage",
  "existingLookbookImage", "lookbookImageFile", "removeLookbookImage", "lookbookFeatured",
];
const DETAILS_SHARED = ["seriesLabel"];

function localePrefixed(locale: string, key: string): string {
  if (locale === SOURCE_LOCALE) return key;
  return `${locale}${key.charAt(0).toUpperCase()}${key.slice(1)}`;
}

function matchesLocaleKey(name: string, locale: string, keys: string[]): boolean {
  return keys.some((key) => name === localePrefixed(locale, key));
}

function matchesPrefix(name: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => name === prefix || name.startsWith(prefix));
}

function matchesLocalePrefix(name: string, locale: string, prefixes: string[]): boolean {
  if (locale === SOURCE_LOCALE) return matchesPrefix(name, prefixes);
  const head = locale.toLowerCase();
  if (!name.toLowerCase().startsWith(head)) return false;
  const rest = name.slice(locale.length);
  const unprefixed = rest.charAt(0).toLowerCase() + rest.slice(1);
  return prefixes.some((prefix) => unprefixed === prefix || unprefixed.startsWith(prefix));
}

function isCharacteristicsField(name: string): boolean {
  return name.startsWith("char_") || name.startsWith("characteristic");
}

/**
 * Whether a FormData key belongs to the given section/locale branch.
 * Shared sections ignore locale. Locale sections only take that locale's copy fields
 * plus section-owned shared scalars (e.g. EN essentials own sku/price).
 */
export function fieldBelongsToBranch(
  fieldName: string,
  section: ProductEditorSection,
  locale: string,
): boolean {
  if (ALWAYS_FROM_CURRENT.has(fieldName) || REQUIRED_FIELDS.has(fieldName)) {
    // Required fields are injected separately; still "belong" to their owner section for marking.
    if (section === "essentials") {
      return ESSENTIALS_SHARED.includes(fieldName) || matchesLocaleKey(fieldName, locale, ESSENTIALS_LOCALE);
    }
    if (section === "price") return PRICE_SHARED.includes(fieldName);
    if (section === "shopify") return SHOPIFY_TAB_SHARED.includes(fieldName);
    return false;
  }

  switch (section) {
    case "essentials":
      return ESSENTIALS_SHARED.includes(fieldName)
        || matchesLocaleKey(fieldName, locale, ESSENTIALS_LOCALE);
    case "price":
      return PRICE_SHARED.includes(fieldName);
    case "catalog":
      return CATALOG_SHARED.includes(fieldName) || isCharacteristicsField(fieldName);
    case "details":
      return DETAILS_SHARED.includes(fieldName)
        || matchesLocaleKey(fieldName, locale, DETAILS_LOCALE)
        || matchesPrefix(fieldName, DETAILS_SHARED_PREFIXES)
        || matchesLocalePrefix(fieldName, locale, DETAILS_LOCALE_PREFIXES);
    case "media":
      return MEDIA_SHARED.includes(fieldName);
    case "metafields":
      return isCustomMetafieldFormField(fieldName);
    case "shopify":
      return SHOPIFY_TAB_SHARED.includes(fieldName);
    default:
      return false;
  }
}

function copyEntry(target: FormData, key: string, value: FormDataEntryValue) {
  if (value instanceof File) {
    if (value.size > 0) target.set(key, value);
    return;
  }
  target.set(key, value);
}

/**
 * Build a save payload that writes only one section/locale branch.
 * Other fields stay at the last saved baseline so unsaved edits in other tabs
 * remain in the DOM but are not persisted yet.
 */
export function buildScopedProductFormData({
  baseline,
  current,
  section,
  locale,
}: {
  baseline: FormData;
  current: FormData;
  section: ProductEditorSection;
  locale: string;
}): FormData {
  const scoped = new FormData();

  for (const [key, value] of baseline.entries()) {
    copyEntry(scoped, key, value);
  }

  for (const key of REQUIRED_FIELDS) {
    const essentialsOwned = section === "essentials"
      && (key === "name" || key === "slug");
    const shopifyOwned = section === "shopify"
      && (key === "sku" || key === "stockOnHand");
    const priceOwned = section === "price" && key === "price";
    const value = ((essentialsOwned || shopifyOwned || priceOwned) ? current.get(key) : null)
      ?? baseline.get(key)
      ?? current.get(key);
    if (typeof value === "string") scoped.set(key, value);
  }

  // workflowState is catalog-owned; only overwrite from current when saving catalog.
  if (section === "catalog") {
    const workflow = current.get("workflowState");
    if (typeof workflow === "string") scoped.set("workflowState", workflow);
  }

  const productId = current.get("productId") ?? baseline.get("productId");
  if (typeof productId === "string") scoped.set("productId", productId);

  for (const [key, value] of current.entries()) {
    if (fieldBelongsToBranch(key, section, locale) || ALWAYS_FROM_CURRENT.has(key)) {
      copyEntry(scoped, key, value);
    }
  }

  // Unchecked checkboxes are absent from FormData — force the Price-tab value.
  if (section === "price") {
    const taxable = current.get("taxable");
    scoped.set("taxable", taxable === "1" || taxable === "on" ? "1" : "0");
  }

  // Pull projections — never written from the editor FormData.
  scoped.delete("cost");
  scoped.delete("compareAt");

  scoped.set("saveScope", `${locale}:${section}`);
  return scoped;
}

export function snapshotFormData(form: HTMLFormElement): FormData {
  const snapshot = new FormData();
  for (const [key, value] of new FormData(form).entries()) {
    if (value instanceof File) continue;
    snapshot.append(key, value);
  }
  return snapshot;
}
