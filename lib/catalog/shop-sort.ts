export const SHOP_SORT_OPTIONS = [
  { value: "featured", label: "Featured" },
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price · low to high" },
  { value: "price-desc", label: "Price · high to low" },
  { value: "name-asc", label: "Name · A–Z" },
] as const;

export type ShopSort = (typeof SHOP_SORT_OPTIONS)[number]["value"];

export function normalizeShopSort(value: string | undefined): ShopSort {
  return SHOP_SORT_OPTIONS.some((option) => option.value === value)
    ? value as ShopSort
    : "featured";
}
