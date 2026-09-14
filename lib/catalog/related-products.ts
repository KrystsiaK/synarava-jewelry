import type { ProductSummary } from "@/lib/content/catalog";

type RelatedProductCandidate = Pick<ProductSummary, "slug" | "shopifyProductId" | "categorySlug">;

/**
 * Orders `catalog` by Shopify's ranked `relatedIds` (matched on
 * shopifyProductId), then backfills with same-category products when
 * Shopify's list is thin — a product with sparse tags/type data can come
 * back with too few (or zero) recommendations.
 */
export function pickRelatedProducts<T extends RelatedProductCandidate>(
  product: RelatedProductCandidate,
  catalog: T[],
  relatedIds: string[],
  limit = 8,
): T[] {
  const byShopifyId = new Map(
    catalog.flatMap((item) => (item.shopifyProductId ? [[item.shopifyProductId, item] as const] : [])),
  );
  const ranked = relatedIds.flatMap((id) => {
    const match = byShopifyId.get(id);
    return match && match.slug !== product.slug ? [match] : [];
  });

  const seen = new Set(ranked.map((item) => item.slug));
  const fallback = catalog.filter((item) => (
    item.slug !== product.slug
    && !seen.has(item.slug)
    && item.categorySlug != null
    && item.categorySlug === product.categorySlug
  ));

  return [...ranked, ...fallback].slice(0, limit);
}
