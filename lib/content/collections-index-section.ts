/**
 * Collections index (`/collections`): every published collection, ordered by
 * admin-selected IDs first (configured order), then any remaining collections
 * in catalog order. Empty admin selection keeps catalog order for all.
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

  if (uniqueSelected.length === 0) return collections;

  const selectedIdSet = new Set(uniqueSelected.map((collection) => collection.id));
  const remainder = collections.filter((collection) => !selectedIdSet.has(collection.id));
  return [...uniqueSelected, ...remainder];
}
