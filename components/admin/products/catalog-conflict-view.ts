/**
 * View-scope filters for catalog conflict UI (product / locale / section).
 * Kept out of the product adapter so that file only maps data → ConflictResolver.
 */

import type { ProductEditorSection } from "@/components/admin/products/product-editor-tabs";
import { productEditorSectionForConflictField } from "@/components/admin/products/commerce-conflict-section";
import type { CatalogConflictField } from "@/lib/shopify/catalog-conflict";
import type {
  CatalogConflictProductSignal,
  CatalogConflictSignals,
} from "@/lib/shopify/catalog-conflict-signals";
/**
 * Locale / section chip count ≡ `selectSyncCounts(..., localeTab)` tree node.
 * Base/EN = shared + presence + EN locale rows. Sibling locales = that code only
 * (shared never lights PT/RU).
 */
function localeTabLeafCountFromSignal(
  signal: CatalogConflictProductSignal,
  locale: string,
): number {
  const code = normalizeLocaleCode(locale);
  const isBase = code === "en" || code === "base";
  const localeCount = signal.locales
    .filter((entry) => normalizeLocaleCode(entry.code) === code)
    .reduce((sum, entry) => sum + entry.count, 0);
  if (!isBase) return localeCount;
  const shared = Math.max(0, signal.sharedCount ?? 0);
  const presence = signal.presence ? 1 : 0;
  return shared + presence + localeCount;
}

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
 * Tree display: SHARED / presence → base (EN) only. Locale rows → that code only.
 * See docs/wiki/commerce-sync.md marker tree.
 */
function isSharedScope(field: CatalogConflictField): boolean {
  return String(field.scope.kind).toUpperCase() === "SHARED";
}

function isBaseLocaleTab(locale: string): boolean {
  const code = normalizeLocaleCode(locale);
  return code === "en" || code === "base";
}

export function fieldMatchesViewLocale(field: CatalogConflictField, locale: string): boolean {
  if (isSharedScope(field)) return isBaseLocaleTab(locale);
  return field.scope.kind === "LOCALE"
    && normalizeLocaleCode(field.scope.code) === normalizeLocaleCode(locale);
}

export function fieldMatchesViewSection(
  field: CatalogConflictField,
  section: ProductEditorSection,
  locale: string,
): boolean {
  if (productEditorSectionForConflictField(field) !== section) return false;
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
  const isBase = isBaseLocaleTab(locale);
  const locales = signal.locales.filter((entry) => normalizeLocaleCode(entry.code) === locale);
  const shared = isBase && Boolean(signal.shared);
  const presence = isBase ? signal.presence : undefined;
  const hasLocaleConflict = locales.some((entry) => entry.count > 0);
  if (!hasLocaleConflict && !shared && !presence) {
    return { ...signals, products: {}, totalCount: 0 };
  }
  const scopedSignal = {
    ...signal,
    shared,
    sharedCount: isBase ? signal.sharedCount : 0,
    presence,
    locales,
  };
  const leafCount = localeTabLeafCountFromSignal(scopedSignal, viewScope.locale);
  return {
    ...signals,
    products: {
      [productId]: {
        ...scopedSignal,
        leafCount,
      },
    },
    totalCount: leafCount > 0 ? 1 : 0,
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

/** Attach product-type impact notes to MANUAL preview entries. */
export function withProductTypeImpactNotes<T extends {
  field: { label: string; fieldKey: string };
  productId?: string;
  impactNote?: string | null;
}>(entries: T[]): T[] {
  const typeIds = new Set(
    entries.filter((entry) => isProductTypeConflictField(entry.field)).map((entry) => entry.productId).filter(Boolean),
  );
  return entries.map((entry) => ({
    ...entry,
    impactNote: isProductTypeConflictField(entry.field)
      ? productTypeApplyImpactNote(typeIds.size)
      : null,
  }));
}

