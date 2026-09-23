import { normalizeShopSort, type ShopSort } from "@/lib/catalog/shop-sort";

export type ShopFilters = {
  q?: string;
  availability?: "in-stock";
  category?: string;
  productType?: string;
  collection?: string;
  tag?: string;
  material?: string;
  finish?: string;
  origin?: string;
  certified?: string;
  sort?: ShopSort;
};

export type FilterOption = {
  value: string;
  label: string;
  /** Short secondary tag shown next to the label. */
  hint?: string;
};

export const FILTERS_STORAGE_KEY = "synarava:shop-filters";

export function buildSearchParams(filters: ShopFilters): string {
  const params = new URLSearchParams();
  if (filters.q?.trim()) params.set("q", filters.q.trim());
  if (filters.availability) params.set("availability", filters.availability);
  if (filters.category) params.set("category", filters.category);
  if (filters.productType) params.set("productType", filters.productType);
  if (filters.collection) params.set("collection", filters.collection);
  if (filters.tag) params.set("tag", filters.tag);
  if (filters.material) params.set("material", filters.material);
  if (filters.finish) params.set("finish", filters.finish);
  if (filters.origin) params.set("origin", filters.origin);
  if (filters.certified) params.set("certified", filters.certified);
  if (filters.sort && filters.sort !== "featured") params.set("sort", filters.sort);
  return params.toString();
}

export function parseShopFilters(searchParams: URLSearchParams): ShopFilters {
  const availability = searchParams.get("availability");
  return {
    q: searchParams.get("q") || undefined,
    // Legacy `department` query param is ignored after department removal.
    availability: availability === "in-stock" ? "in-stock" : undefined,
    category: searchParams.get("category") || undefined,
    productType: searchParams.get("productType") || undefined,
    collection: searchParams.get("collection") || undefined,
    tag: searchParams.get("tag") || undefined,
    material: searchParams.get("material") || undefined,
    finish: searchParams.get("finish") || undefined,
    origin: searchParams.get("origin") || undefined,
    certified: searchParams.get("certified") || undefined,
    sort: normalizeShopSort(searchParams.get("sort") || undefined),
  };
}

export function countActiveFilters(filters: ShopFilters): number {
  return [filters.q, filters.availability, filters.category, filters.productType, filters.collection, filters.tag, filters.material, filters.finish, filters.origin, filters.certified].filter(Boolean).length;
}

export function filtersWithoutSort(filters: ShopFilters): ShopFilters {
  return filters.sort && filters.sort !== "featured" ? { sort: filters.sort } : {};
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
