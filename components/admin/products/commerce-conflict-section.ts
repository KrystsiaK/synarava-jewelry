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
    || /^variants\[\d+\]\.inventoryItem\.(requiresShipping|tracked|countryCodeOfOrigin|harmonizedSystemCode|measurement)(\.|$)/.test(path)
    || field === "Variant SKU"
    || field === "Barcode"
    || field === "Available quantity"
    || field === "Inventory policy"
  ) {
    return "inventory";
  }

  if (
    /^(title|handle|vendor|productType|tags)(\.|$|\[)/.test(path)
    || field === "Name"
    || field === "Handle"
    || field === "Vendor"
    || field === "Product type"
    || field === "Tags"
  ) {
    return "essentials";
  }

  if (
    /^(category|status|collections|resourcePublicationsV2|publications)(\.|$|\[)/.test(path)
    || field === "Product category"
    || field === "Status"
  ) {
    return "essentials";
  }

  if (
    /^(descriptionHtml|seo)(\.|$)/.test(path)
    || field === "Description"
    || field === "SEO title"
    || field === "SEO description"
  ) {
    return "essentials";
  }

  // Path is authoritative; label may be the raw path (unlabeled leaf) or "Media gallery (…)".
  if (
    /^media(\.|$|\[)/.test(path)
    || /^media(\.|$|\[)/i.test(field)
    || /^Media gallery/i.test(field)
  ) {
    return "media";
  }

  if (/^metafields(\.|$|\[)/.test(path) || field === "Metafields") return "metafields";

  return "shopify";
}

/**
 * Map a conflict-modal field row → the editor section that owns it.
 * Commerce uses path when present (media diffs are unlabeled paths); else label.
 */
export function productEditorSectionForConflictField(field: {
  origin: "COMMERCE" | "TRANSLATION" | "PRESENCE";
  label: string;
  fieldKey: string;
  path?: string | null;
}): ProductEditorSection {
  if (field.origin === "PRESENCE") return "shopify";
  if (field.origin === "COMMERCE") {
    return productEditorSectionForCommerceDiff({
      path: field.path ?? undefined,
      field: field.label,
    });
  }
  const key = field.fieldKey.split(":")[2] ?? "";
  if (key === "title" || key === "localizedHandle" || key === "name" || key === "handle") {
    return "essentials";
  }
  if (
    key === "description"
    || key === "body"
    || key === "seoTitle"
    || key === "seoDescription"
  ) {
    return "essentials";
  }
  if (
    key === "shortDescription"
    || key === "materialLine"
    || key === "symbolismLabel"
    || key === "symbolismTitle"
    || key === "symbolismBody"
    || key === "symbolismBody2"
  ) {
    return "details";
  }
  return "details";
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
