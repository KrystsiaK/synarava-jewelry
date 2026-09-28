/**
 * Collections index (`/collections`): the admin list is an allowlist.
 * A non-empty selection renders only those published collections, in that
 * order. An empty selection is unconfigured and keeps catalog order for all.
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
  return uniqueSelected;
}
