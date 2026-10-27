import {
  parseShopListState,
  serializeShopListState,
  type ShopFilters,
} from "@/lib/catalog/shop-list-state";

export type { ShopFilters } from "@/lib/catalog/shop-list-state";
export type { ShopSort } from "@/lib/catalog/shop-sort";

export type FilterOption = {
  value: string;
  label: string;
  /** Short secondary tag shown next to the label. */
  hint?: string;
};

/** @deprecated Site list-state is URL-only; kept so old keys can be cleared once. */
export const FILTERS_STORAGE_KEY = "synarava:shop-filters";

export function buildSearchParams(filters: ShopFilters): string {
  return serializeShopListState(filters);
}

export function parseShopFilters(searchParams: URLSearchParams): ShopFilters {
  return parseShopListState(searchParams);
}

export function countActiveFilters(filters: ShopFilters): number {
  return [
    filters.q,
    filters.availability,
    filters.category,
    filters.productType,
    filters.collection,
    filters.tag,
    filters.material,
    filters.finish,
    filters.origin,
    filters.certified,
  ].filter(Boolean).length;
}

/** Clear filters but keep a non-default sort (shop Clear all UX). */
export function filtersWithoutSort(filters: ShopFilters): ShopFilters {
  return filters.sort && filters.sort !== "featured" ? { sort: filters.sort } : {};
}

/** One-shot cleanup of the legacy session key (site adapter does not restore). */
export function clearFiltersSession() {
  /* c8 ignore next */
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(FILTERS_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
