/**
 * Gallery alt helpers shared by Push / compare / storefront checklist.
 * Media tab persistence lives in `lib/products/gallery.ts` (frame ops by id).
 * Distinct per-image alts are SoT in extras.media (+ ProductMedia staging for
 * pending `local:<assetId>` frames). Never broadcast the product title onto
 * every image on Push/Save — that collapses unique alts (Soleil Lemon bug).
 */

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function trimAlt(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Raw per-index alts from OUR window — empty string when missing (no `Image N` placeholder). */
export function rawMediaAltsFromOurWindow(windowOrExtras: unknown): string[] {
  if (!isPlainObject(windowOrExtras)) return [];
  const media = windowOrExtras.media;
  if (!Array.isArray(media)) return [];
  return media.map((node) => (isPlainObject(node) ? trimAlt(node.alt) : ""));
}

/**
 * Resolve one gallery image alt for Push.
 * Priority: local ProductMedia → OUR tree → existing remote.
 * Do not fall back to the product title — that made every image identical.
 */
export function resolveGalleryMediaAlt(input: {
  localAlt?: string | null;
  treeAlt?: string | null;
  remoteAlt?: string | null;
  /** Accepted for API clarity; intentionally unused so titles cannot broadcast. */
  productTitleFallback?: string | null;
}): string {
  void input.productTitleFallback;
  const local = trimAlt(input.localAlt);
  if (local) return local;
  const tree = trimAlt(input.treeAlt);
  if (tree) return tree;
  return trimAlt(input.remoteAlt);
}

/** Preview / image URL from a Shopify-shaped media node. */
export function mediaNodePreviewUrl(node: unknown): string | null {
  if (!isPlainObject(node)) return null;
  const preview = isPlainObject(node.preview) ? node.preview : null;
  const previewImage = preview && isPlainObject(preview.image) ? preview.image : null;
  const image = isPlainObject(node.image) ? node.image : null;
  if (previewImage && typeof previewImage.url === "string" && previewImage.url) {
    return previewImage.url;
  }
  if (image && typeof image.url === "string" && image.url) return image.url;
  return null;
}

/**
 * OUR-tree media nodes when the window/extras has a `media` key.
 * - `null` — no `media` key (legacy: do not treat tree as SoT).
 * - `unknown[]` — tree is SoT (may be empty after intentional clear).
 */
export function ourMediaNodes(windowOrExtras: unknown): unknown[] | null {
  if (!isPlainObject(windowOrExtras) || !("media" in windowOrExtras)) return null;
  return Array.isArray(windowOrExtras.media) ? windowOrExtras.media : [];
}

/**
 * Shopify media GIDs retained on Push from OUR media tree.
 * - `null` — no `media` key (legacy: do not treat tree as SoT).
 * - `string[]` — tree is SoT; remote media not listed must be omitted from
 *   `productSet.files` so Shopify deletes them (list-field semantics).
 */
export function retainedShopifyMediaIds(windowOrExtras: unknown): string[] | null {
  const media = ourMediaNodes(windowOrExtras);
  if (media == null) return null;
  return media.flatMap((node) => {
    if (!isPlainObject(node) || typeof node.id !== "string") return [];
    return node.id.startsWith("gid://shopify/") ? [node.id] : [];
  });
}

export type OurMediaFrame = {
  id: string | null;
  url: string;
  alt: string;
  width: number | null;
  height: number | null;
};

function frameFromMediaNode(node: unknown, index: number): OurMediaFrame | null {
  if (!isPlainObject(node)) return null;
  const preview = isPlainObject(node.preview) ? node.preview : null;
  const previewImage = preview && isPlainObject(preview.image) ? preview.image : null;
  const image = isPlainObject(node.image) ? node.image : null;
  const url =
    (previewImage && typeof previewImage.url === "string" ? previewImage.url : null)
    || (image && typeof image.url === "string" ? image.url : null);
  if (!url) return null;
  const width =
    (previewImage && typeof previewImage.width === "number" ? previewImage.width : null)
    ?? (image && typeof image.width === "number" ? image.width : null);
  const height =
    (previewImage && typeof previewImage.height === "number" ? previewImage.height : null)
    ?? (image && typeof image.height === "number" ? image.height : null);
  return {
    id: typeof node.id === "string" ? node.id : null,
    url,
    alt: typeof node.alt === "string" && node.alt.trim() ? node.alt.trim() : `Image ${index + 1}`,
    width,
    height,
  };
}

/** Frames from OUR window/extras.media only — never fall back to shopifySnapshot. */
export function mediaFramesFromOurWindow(windowOrExtras: unknown): OurMediaFrame[] {
  if (!isPlainObject(windowOrExtras)) return [];
  const media = windowOrExtras.media;
  if (!Array.isArray(media) || media.length === 0) return [];
  return media.flatMap((node, index) => {
    const frame = frameFromMediaNode(node, index);
    return frame ? [frame] : [];
  });
}
