/**
 * View-scope filters for catalog conflict UI (product / locale / section).
 * Kept out of the product adapter so that file only maps data → ConflictResolver.
 */

import type { ProductEditorSection } from "@/components/admin/products/product-editor-tabs";
import { productEditorSectionForConflictField } from "@/components/admin/products/commerce-conflict-section";
import type { CatalogConflictField } from "@/lib/shopify/catalog-conflict";
import type { CatalogConflictSignals } from "@/lib/shopify/catalog-conflict-signals";
import { productConflictBadgeCount } from "@/lib/sync/badge-count";

/**
 * Same conflict UI, different tree node:
 * full catalog · one product · one product locale · one editor section.
 */
export type CatalogConflictViewScope =
  | { kind: "catalog" }
  | { kind: "product"; productId: string }
  | { kind: "productLocale"; productId: string; locale: string }
  | { kind: "productSection"; productId: string; locale: string; section: ProductEditorSection };

function normalizeLocaleCode(locale: string) {
  return locale.trim().toLowerCase();
}

/**
 * Language shells include SHARED commerce under every locale (EN/PT/RU)
 * plus that locale's translation rows. See docs/wiki/commerce-sync.md marker tree.
 */
function isSharedScope(field: CatalogConflictField): boolean {
  return String(field.scope.kind).toUpperCase() === "SHARED";
}

export function fieldMatchesViewLocale(field: CatalogConflictField, locale: string): boolean {
  if (isSharedScope(field)) return true;
  return field.scope.kind === "LOCALE"
    && normalizeLocaleCode(field.scope.code) === normalizeLocaleCode(locale);
}

export function fieldMatchesViewSection(
  field: CatalogConflictField,
  section: ProductEditorSection,
  locale: string,
): boolean {
  if (productEditorSectionForConflictField(field) !== section) return false;
  if (isSharedScope(field)) return true;
  return fieldMatchesViewLocale(field, locale);
}

export function filterConflictFieldsForView(
  fields: CatalogConflictField[],
  viewScope: CatalogConflictViewScope | undefined,
): CatalogConflictField[] {
  if (!viewScope || viewScope.kind === "catalog" || viewScope.kind === "product") return fields;
  if (viewScope.kind === "productLocale") {
    return fields.filter((field) => fieldMatchesViewLocale(field, viewScope.locale));
  }
  return fields.filter((field) => fieldMatchesViewSection(field, viewScope.section, viewScope.locale));
}

export function filterSignalsForView(
  signals: CatalogConflictSignals,
  viewScope: CatalogConflictViewScope | undefined,
): CatalogConflictSignals {
  if (!viewScope || viewScope.kind === "catalog") return signals;
  const productId = viewScope.productId;
  const signal = signals.products[productId];
  if (!signal) {
    return { ...signals, products: {}, totalCount: 0 };
  }
  if (viewScope.kind === "product") {
    return { ...signals, products: { [productId]: signal }, totalCount: 1 };
  }
  const locale = normalizeLocaleCode(viewScope.locale);
  const locales = signal.locales.filter((entry) => normalizeLocaleCode(entry.code) === locale);
  const shared = Boolean(signal.shared);
  const hasLocaleConflict = locales.some((entry) => entry.count > 0);
  if (!hasLocaleConflict && !shared && !signal.presence) {
    return { ...signals, products: {}, totalCount: 0 };
  }
  const scoped = {
    ...signal,
    shared,
    locales,
    leafCount: undefined,
  };
  return {
    ...signals,
    products: {
      [productId]: {
        ...scoped,
        leafCount: productConflictBadgeCount(scoped),
      },
    },
    totalCount: 1,
  };
}

export function isProductScoped(viewScope: CatalogConflictViewScope | undefined): viewScope is
  | { kind: "product"; productId: string }
  | { kind: "productLocale"; productId: string; locale: string }
  | { kind: "productSection"; productId: string; locale: string; section: ProductEditorSection } {
  return viewScope?.kind === "product"
    || viewScope?.kind === "productLocale"
    || viewScope?.kind === "productSection";
}

export function isLocaleOrSectionScoped(
  viewScope: CatalogConflictViewScope,
): viewScope is
  | { kind: "productLocale"; productId: string; locale: string }
  | { kind: "productSection"; productId: string; locale: string; section: ProductEditorSection } {
  return viewScope.kind === "productLocale" || viewScope.kind === "productSection";
}

/** True when the conflict field is the shared commerce Product type (EN productType). */
export function isProductTypeConflictField(field: { label: string; fieldKey: string }): boolean {
  return field.label === "Product type"
    || field.fieldKey.toLowerCase().includes("product_type")
    || field.fieldKey.toLowerCase().includes("product-type");
}

/** Confirm copy for product-type Apply — shared vocabulary affects every product using the type. */
export function productTypeApplyImpactNote(affectedProductCount: number): string {
  const n = Math.max(1, affectedProductCount);
  if (n === 1) {
    return "Product type is a shared label — confirming affects 1 product that uses this type name.";
  }
  return `Product type is a shared label — confirming affects ${n} products that use this type name.`;
}
