export type HomeCollectionMedia = {
  image?: string | null;
};

export type FinalCtaImage = {
  image: string;
};

export function buildFinalCtaImages<T extends HomeCollectionMedia>(
  collections: T[],
): Array<T & FinalCtaImage> {
  const availableImages = collections.filter(
    (collection): collection is T & FinalCtaImage => Boolean(collection?.image),
  );

  if (availableImages.length === 0) {
    return [];
  }

  return Array.from(
    { length: 4 },
    (_, index) => availableImages[index % availableImages.length],
  );
}
