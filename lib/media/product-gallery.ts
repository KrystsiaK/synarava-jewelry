export type ProductGalleryImage = {
  src: string;
  alt: string;
  width: number | null;
  height: number | null;
};

export function combineProductGallery(
  primary: ProductGalleryImage | null,
  local: ProductGalleryImage[],
  shopify: ProductGalleryImage[],
) {
  const seen = new Set<string>();
  return [primary, ...local, ...shopify].flatMap((image) => {
    if (!image?.src || seen.has(image.src)) return [];
    seen.add(image.src);
    return [image];
  });
}
