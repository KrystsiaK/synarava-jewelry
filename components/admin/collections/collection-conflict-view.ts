/**
 * View-scope filters for collection conflict UI.
 * Kept out of the workspace component so that file only wires FieldConflictPanel.
 */

import type { CatalogConflictField } from "@/lib/shopify/catalog-conflict";
import type { CatalogConflictSignals } from "@/lib/shopify/catalog-conflict-signals";

export type CollectionConflictViewScope =
  | { kind: "catalog" }
  | { kind: "collection"; collectionId: string }
  | { kind: "collectionLocale"; collectionId: string; locale: string };

function normalizeLocaleCode(locale: string) {
  return locale.trim().toLowerCase();
}

/** Shared commerce/presence under every language shell; plus that locale's rows. */
export function fieldMatchesCollectionViewLocale(field: CatalogConflictField, locale: string): boolean {
  if (String(field.scope.kind).toUpperCase() === "SHARED") return true;
  return field.scope.kind === "LOCALE"
    && normalizeLocaleCode(field.scope.code) === normalizeLocaleCode(locale);
}

export function filterCollectionFieldsForView(
  fields: CatalogConflictField[],
  viewScope: CollectionConflictViewScope | undefined,
): CatalogConflictField[] {
  if (!viewScope || viewScope.kind === "catalog" || viewScope.kind === "collection") return fields;
  return fields.filter((field) => fieldMatchesCollectionViewLocale(field, viewScope.locale));
}

export function filterCollectionSignalsForView(
  signals: CatalogConflictSignals,
  viewScope: CollectionConflictViewScope | undefined,
): CatalogConflictSignals {
  if (!viewScope || viewScope.kind === "catalog") return signals;
  const collectionId = viewScope.collectionId;
  const signal = signals.products[collectionId];
  if (!signal) return { ...signals, products: {}, totalCount: 0 };
  if (viewScope.kind === "collection") {
    return { ...signals, products: { [collectionId]: signal }, totalCount: 1 };
  }
  const locale = normalizeLocaleCode(viewScope.locale);
  const locales = signal.locales.filter((entry) => normalizeLocaleCode(entry.code) === locale);
  const shared = Boolean(signal.shared);
  const hasLocaleConflict = locales.some((entry) => entry.count > 0);
  if (!hasLocaleConflict && !shared && !signal.presence) {
    return { ...signals, products: {}, totalCount: 0 };
  }
  return {
    ...signals,
    products: { [collectionId]: { ...signal, shared, locales } },
    totalCount: 1,
  };
}

export function isCollectionScoped(viewScope: CollectionConflictViewScope | undefined): viewScope is
  | { kind: "collection"; collectionId: string }
  | { kind: "collectionLocale"; collectionId: string; locale: string } {
  return viewScope?.kind === "collection" || viewScope?.kind === "collectionLocale";
}
