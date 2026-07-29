export type HomeCollectionMedia = {
  image?: string | null;
};

export function buildFinalCtaImages<T extends HomeCollectionMedia>(
  collections: T[],
): T[] {
  const availableImages = collections.filter(
    (collection): collection is T => Boolean(collection?.image),
  );

  if (availableImages.length === 0) {
    return [];
  }

  return Array.from(
    { length: 4 },
    (_, index) => availableImages[index % availableImages.length],
  );
}
