/**
 * View-scope filters for collection conflict UI.
 * Kept out of the collection adapter so that file only maps data → ConflictResolver.
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

function isBaseLocaleTab(locale: string): boolean {
  const code = normalizeLocaleCode(locale);
  return code === "en" || code === "base";
}

/** Tree display: SHARED → base/EN only; locale rows → that code only. */
export function fieldMatchesCollectionViewLocale(field: CatalogConflictField, locale: string): boolean {
  if (String(field.scope.kind).toUpperCase() === "SHARED") return isBaseLocaleTab(locale);
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
    const leafCount = Math.max(0, signal.leafCount ?? 0);
    return { ...signals, products: { [collectionId]: signal }, totalCount: leafCount };
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
  const leafCount = (isBase ? Math.max(0, signal.sharedCount ?? 0) : 0)
    + (presence ? 1 : 0)
    + locales.reduce((sum, entry) => sum + entry.count, 0);
  return {
    ...signals,
    products: {
      [collectionId]: {
        ...signal,
        shared,
        sharedCount: isBase ? signal.sharedCount : 0,
        presence,
        locales,
        leafCount,
      },
    },
    totalCount: leafCount,
  };
}

export function isCollectionScoped(viewScope: CollectionConflictViewScope | undefined): viewScope is
  | { kind: "collection"; collectionId: string }
  | { kind: "collectionLocale"; collectionId: string; locale: string } {
  return viewScope?.kind === "collection" || viewScope?.kind === "collectionLocale";
}
