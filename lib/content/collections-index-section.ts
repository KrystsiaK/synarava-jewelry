/**
 * Collections index (`/collections`): ordered IDs from admin,
 * or every published collection (catalog order) when none are chosen.
 */

export type CollectionsIndexCollection = {
  id: string;
};

export function resolveCollectionsIndexCollections<T extends CollectionsIndexCollection>(
  collections: T[],
  selectedIds: string[] | undefined | null,
): T[] {
  const byId = new Map(collections.map((collection) => [collection.id, collection]));
  const uniqueSelected = [...new Set((selectedIds ?? []).map((id) => id.trim()).filter(Boolean))]
    .map((id) => byId.get(id))
    .filter((collection): collection is T => Boolean(collection));

  if (uniqueSelected.length > 0) return uniqueSelected;

  return collections;
}
