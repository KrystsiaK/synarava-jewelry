import type { ProductEditorSection } from "@/components/admin/products/product-editor-tabs";
import { isSharedSection } from "@/components/admin/products/product-editor-scope";

/**
 * Map one commerce conflict fact → the product editor section tab that owns it.
 * Unknown paths land on Sync (`shopify`), never on every tab.
 */
export function productEditorSectionForCommerceDiff(diff: {
  path?: string;
  field: string;
}): ProductEditorSection {
  const path = diff.path ?? "";
  const field = diff.field;

  if (path === "_presence" || field === "Presence") return "shopify";

  if (
    /^variants\[\d+\]\.(price|compareAtPrice|taxable)(\.|$)/.test(path)
    || /^variants\[\d+\]\.inventoryItem\.unitCost/.test(path)
    || field === "Price"
    || field === "Compare-at price"
    || field === "Charge tax"
    || field === "Cost"
  ) {
    return "price";
  }

  if (
    /^variants\[\d+\]\.(sku|barcode|inventoryQuantity|inventoryPolicy)(\.|$)/.test(path)
    || field === "Variant SKU"
    || field === "Barcode"
    || field === "Available quantity"
    || field === "Inventory policy"
  ) {
    return "essentials";
  }

  if (
    /^(title|handle|vendor|productType)(\.|$)/.test(path)
    || field === "Name"
    || field === "Handle"
    || field === "Vendor"
    || field === "Product type"
  ) {
    return "essentials";
  }

  if (
    /^(category|tags|status|collections|resourcePublicationsV2|publications)(\.|$|\[)/.test(path)
    || field === "Product category"
    || field === "Tags"
    || field === "Status"
  ) {
    return "catalog";
  }

  if (
    /^(descriptionHtml|seo)(\.|$)/.test(path)
    || field === "Description"
    || field === "SEO title"
    || field === "SEO description"
  ) {
    return "content";
  }

  if (/^media(\.|$|\[)/.test(path)) return "media";

  return "shopify";
}

/** Sections whose tabs should show conflict tone for the given differences. */
export function conflictSectionsFromDifferences(
  differences: ReadonlyArray<{ path?: string; field: string }>,
): Set<ProductEditorSection> {
  const sections = new Set<ProductEditorSection>();
  for (const diff of differences) {
    sections.add(productEditorSectionForCommerceDiff(diff));
  }
  return sections;
}

/**
 * Language shells to mark for a conflict set.
 * Shared commerce (Price, Catalog, …) → every locale. Locale-only → those codes only.
 * @see docs/admin/commerce-sync.md
 */
export function conflictLocalesFromCommerce(input: {
  localeCodes: readonly string[];
  conflictSections: ReadonlySet<ProductEditorSection>;
  sharedSignal?: boolean;
  presenceSignal?: boolean;
  localeSignals?: ReadonlyArray<{ code: string; count: number }>;
}): Set<string> {
  const out = new Set<string>();
  const sharedHit = [...input.conflictSections].some((section) => isSharedSection(section))
    || Boolean(input.sharedSignal)
    || Boolean(input.presenceSignal);
  if (sharedHit) {
    for (const code of input.localeCodes) out.add(code);
  }
  for (const locale of input.localeSignals ?? []) {
    if (locale.count > 0) out.add(locale.code);
  }
  return out;
}
