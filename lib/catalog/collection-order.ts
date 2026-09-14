export function moveCollectionItem<T>(items: T[], item: T, requestedPosition: number) {
  const currentPosition = items.indexOf(item);
  if (currentPosition === -1) return [...items];

  const next = [...items];
  next.splice(currentPosition, 1);
  const position = Math.max(0, Math.min(Math.trunc(requestedPosition), next.length));
  next.splice(position, 0, item);
  return next;
}

export function syncedOrderPosition(orderedIds: string[], syncedIds: Set<string>, productId: string) {
  return orderedIds.filter((id) => syncedIds.has(id)).indexOf(productId);
}

export function productCollectionPosition(
  product: { collections: Array<{ sortOrder: number; collection: { id: string } }> },
  collectionId: string,
) {
  return product.collections.find((item) => item.collection.id === collectionId)?.sortOrder
    ?? Number.POSITIVE_INFINITY;
}

/**
 * Storefront "Featured" ordering: within a chosen collection, its manual
 * sortOrder; browsing the whole catalog (no collection picked), the one
 * collection flagged `isStorefrontDefault` — the global product priority.
 */
export function featuredCollectionPosition(
  collections: Array<{ sortOrder: number; collection: { slug: string; isStorefrontDefault: boolean } }>,
  collectionSlug?: string,
) {
  const membership = collectionSlug
    ? collections.find((item) => item.collection.slug === collectionSlug)
    : collections.find((item) => item.collection.isStorefrontDefault);
  return membership?.sortOrder ?? Number.POSITIVE_INFINITY;
}
