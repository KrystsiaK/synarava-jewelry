/**
 * Read gallery frames from a product's Shopify-shaped snapshot (working or shopify).
 * Admin Media tab uses this when local ProductMedia rows are empty but Shopify already has images.
 */

export type ShopifySnapshotMediaFrame = {
  id: string | null;
  url: string;
  alt: string;
  width: number | null;
  height: number | null;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function frameFromMediaNode(node: unknown, index: number): ShopifySnapshotMediaFrame | null {
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
    alt: typeof node.alt === "string" && node.alt.trim() ? node.alt.trim() : `Shopify image ${index + 1}`,
    width,
    height,
  };
}

/** Prefer shopifySnapshot, fall back to workingSnapshot — both are Shopify-shaped. */
export function mediaFramesFromProductSnapshots(input: {
  shopifySnapshot?: unknown;
  workingSnapshot?: unknown;
}): ShopifySnapshotMediaFrame[] {
  for (const snapshot of [input.shopifySnapshot, input.workingSnapshot]) {
    if (!isPlainObject(snapshot)) continue;
    const media = snapshot.media;
    if (!Array.isArray(media) || media.length === 0) continue;
    const frames = media.flatMap((node, index) => {
      const frame = frameFromMediaNode(node, index);
      return frame ? [frame] : [];
    });
    if (frames.length > 0) return frames;
  }
  return [];
}
