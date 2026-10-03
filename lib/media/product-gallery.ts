export type ProductGalleryImage = {
  src: string;
  alt: string;
  width: number | null;
  height: number | null;
  /** Shopify MediaImage GID when known — preferred dedupe key. */
  id?: string | null;
};

const SHOPIFY_CDN_HOST_RE = /(^|\.)cdn\.shopify\.com$/i;

/**
 * Normalize image URLs so featured/cover and gallery frames of the same file
 * collide even when Shopify appends `?v=` or size suffixes (`_2048x`).
 */
export function normalizeGallerySrc(src: string): string {
  const trimmed = src.trim();
  if (!trimmed) return "";
  try {
    if (!/^https?:\/\//i.test(trimmed)) return trimmed;
    const url = new URL(trimmed);
    const isShopifyCdn =
      SHOPIFY_CDN_HOST_RE.test(url.hostname) || url.hostname.endsWith(".shopifycdn.com");
    if (!isShopifyCdn) return `${url.origin}${url.pathname}`;
    // Drop volatile query/hash and Shopify resize suffixes on the filename.
    const path = url.pathname.replace(/_(?:\d+x\d*|\d*x\d+)(?=\.[^./]+$)/, "");
    return `${url.origin}${path}`;
  } catch {
    return trimmed;
  }
}

/** Prefer media id; fall back to normalized src. */
export function productGalleryDedupeKey(image: Pick<ProductGalleryImage, "src" | "id">): string {
  const id = image.id?.trim();
  if (id) return `id:${id}`;
  return `src:${normalizeGallerySrc(image.src)}`;
}

/**
 * Merge cover + local + Shopify gallery frames, keeping cover first and
 * dropping duplicates by media id or normalized URL.
 */
export function combineProductGallery(
  primary: ProductGalleryImage | null,
  local: ProductGalleryImage[],
  shopify: ProductGalleryImage[],
) {
  const seen = new Set<string>();
  return [primary, ...local, ...shopify].flatMap((image) => {
    if (!image?.src?.trim()) return [];
    const srcKey = `src:${normalizeGallerySrc(image.src)}`;
    const id = image.id?.trim();
    const idKey = id ? `id:${id}` : null;
    if (seen.has(srcKey) || (idKey != null && seen.has(idKey))) return [];
    seen.add(srcKey);
    if (idKey) seen.add(idKey);
    return [{
      src: image.src,
      alt: image.alt,
      width: image.width,
      height: image.height,
    }];
  });
}
