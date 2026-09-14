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
