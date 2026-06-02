export type ShopFilters = {
  q?: string;
  category?: string;
  collection?: string;
  tag?: string;
};

export type FilterOption = {
  value: string;
  label: string;
};

export const FILTERS_STORAGE_KEY = "synarava:shop-filters";

export function buildSearchParams(filters: ShopFilters): string {
  const params = new URLSearchParams();
  if (filters.q?.trim()) params.set("q", filters.q.trim());
  if (filters.category) params.set("category", filters.category);
  if (filters.collection) params.set("collection", filters.collection);
  if (filters.tag) params.set("tag", filters.tag);
  return params.toString();
}

export function countActiveFilters(filters: ShopFilters): number {
  return [filters.q, filters.category, filters.collection, filters.tag].filter(Boolean).length;
}

export function saveFiltersToSession(filters: ShopFilters) {
  /* c8 ignore next */
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters));
  } catch {}
}

export function loadFiltersFromSession(): ShopFilters | null {
  /* c8 ignore next */
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(FILTERS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ShopFilters;
    if (countActiveFilters(parsed) === 0) return null;
    return parsed;
  } catch {
    /* c8 ignore next */
    return null;
  }
}

export function clearFiltersSession() {
  /* c8 ignore next */
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(FILTERS_STORAGE_KEY);
  } catch {}
}
