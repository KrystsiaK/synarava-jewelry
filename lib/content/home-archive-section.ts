/**
 * Home “Featured collections” (ArchivePathway): ordered IDs from admin,
 * or the newest published collection when none are chosen.
 */

export type HomeArchiveCollection = {
  id: string;
  createdAt?: Date | string | null;
};

export function resolveHomeArchiveCollections<T extends HomeArchiveCollection>(
  collections: T[],
  selectedIds: string[] | undefined | null,
): T[] {
  const byId = new Map(collections.map((collection) => [collection.id, collection]));
  const uniqueSelected = [...new Set((selectedIds ?? []).map((id) => id.trim()).filter(Boolean))]
    .map((id) => byId.get(id))
    .filter((collection): collection is T => Boolean(collection));

  if (uniqueSelected.length > 0) return uniqueSelected;

  const newest = [...collections].toSorted((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bTime - aTime;
  });

  return newest.slice(0, 1);
}
