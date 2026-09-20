import type { ShopListingProduct } from "@/lib/content/shop-listing";
import type { ShopFilters } from "@/lib/content/catalog";

function hasCharacteristic(
  product: ShopListingProduct,
  key: string,
  value?: string,
) {
  return product.characteristics.some((characteristic) => (
    characteristic.key === key
    && (value ? characteristic.textValue === value : characteristic.booleanValue === true)
  ));
}

export function filterAndSortShopProducts(
  products: ShopListingProduct[],
  filters: ShopFilters,
  popularProductSlugs: string[],
  locale: string,
) {
  const query = filters.q?.trim().toLocaleLowerCase();
  const popularRank = new Map(popularProductSlugs.map((slug, index) => [slug, index]));

  const filtered = products.filter((product) => {
    if (filters.department && product.departmentSlug !== filters.department) return false;
    if (filters.availability === "in-stock" && !product.inStock) return false;
    if (filters.category && product.categorySlug !== filters.category) return false;
    if (filters.productType && product.productType !== filters.productType) return false;
    if (filters.collection && !product.collectionSlugs.includes(filters.collection)) return false;
    if (filters.tag && !product.tagSlugs.includes(filters.tag)) return false;
    if (filters.material && !hasCharacteristic(product, "material", filters.material)) return false;
    if (filters.finish && !hasCharacteristic(product, "finish", filters.finish)) return false;
    if (filters.origin && !hasCharacteristic(product, "origin", filters.origin)) return false;
    if (filters.certified && !hasCharacteristic(product, filters.certified)) return false;

    if (query) {
      const searchable = product.searchText.toLocaleLowerCase();
      if (!searchable.includes(query)) return false;
    }

    return true;
  });

  if (filters.sort === "popular") {
    return [...filtered].sort((left, right) => (
      (popularRank.get(left.slug) ?? Number.POSITIVE_INFINITY)
      - (popularRank.get(right.slug) ?? Number.POSITIVE_INFINITY)
    ));
  }
  if (filters.sort === "newest") {
    return [...filtered].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
  }
  if (filters.sort === "price-asc") {
    return [...filtered].sort((left, right) => left.priceAmount - right.priceAmount);
  }
  if (filters.sort === "price-desc") {
    return [...filtered].sort((left, right) => right.priceAmount - left.priceAmount);
  }
  if (filters.sort === "name-asc") {
    return [...filtered].sort((left, right) => left.title.localeCompare(right.title, locale));
  }
  return filtered;
}
