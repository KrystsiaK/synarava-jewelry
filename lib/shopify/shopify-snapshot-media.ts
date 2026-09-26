/**
 * Gallery frames from the OUR commerce tree (`workingSnapshot.media`).
 * ProductMedia / S3 rows are a staging cache — conflict UI and Media tab read the tree.
 */

export type WorkingSnapshotMediaFrame = {
  id: string | null;
  url: string;
  alt: string;
  width: number | null;
  height: number | null;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function frameFromMediaNode(node: unknown, index: number): WorkingSnapshotMediaFrame | null {
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

/** Frames from OUR window only — never fall back to shopifySnapshot (that was a second UI world). */
export function mediaFramesFromWorkingSnapshot(workingSnapshot: unknown): WorkingSnapshotMediaFrame[] {
  if (!isPlainObject(workingSnapshot)) return [];
  const media = workingSnapshot.media;
  if (!Array.isArray(media) || media.length === 0) return [];
  return media.flatMap((node, index) => {
    const frame = frameFromMediaNode(node, index);
    return frame ? [frame] : [];
  });
}

/** @deprecated use mediaFramesFromWorkingSnapshot */
export function mediaFramesFromProductSnapshots(input: {
  shopifySnapshot?: unknown;
  workingSnapshot?: unknown;
}): WorkingSnapshotMediaFrame[] {
  return mediaFramesFromWorkingSnapshot(input.workingSnapshot);
}
