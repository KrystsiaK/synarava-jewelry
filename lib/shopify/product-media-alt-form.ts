/**
 * Gallery alt FormData keys used by ProductMediaManager.
 * Local rows: `media-alt-{productMediaId}`
 * OUR tree frames (no local rows): `media-alt-tree-{index}`
 */

export type LocalMediaAltFormUpdate = { mediaId: string; alt: string };
export type TreeMediaAltFormUpdate = { index: number; alt: string };

export function mediaAltUpdatesFromForm(formData: FormData): {
  local: LocalMediaAltFormUpdate[];
  tree: TreeMediaAltFormUpdate[];
} {
  const local: LocalMediaAltFormUpdate[] = [];
  const tree: TreeMediaAltFormUpdate[] = [];
  const seenLocal = new Set<string>();
  const seenTree = new Set<number>();

  for (const [name, raw] of formData.entries()) {
    if (typeof raw !== "string") continue;

    if (name.startsWith("media-alt-tree-")) {
      const index = Number(name.slice("media-alt-tree-".length));
      if (!Number.isInteger(index) || index < 0 || seenTree.has(index)) continue;
      seenTree.add(index);
      tree.push({ index, alt: raw.trim() });
      continue;
    }

    if (name.startsWith("media-alt-")) {
      const mediaId = name.slice("media-alt-".length).trim();
      if (!mediaId || seenLocal.has(mediaId)) continue;
      seenLocal.add(mediaId);
      local.push({ mediaId, alt: raw.trim() });
    }
  }

  return { local, tree };
}

/** Apply tree-index alt edits onto a Shopify-shaped media array (clone). */
export function applyTreeMediaAltUpdates(
  media: unknown[],
  updates: ReadonlyArray<TreeMediaAltFormUpdate>,
): unknown[] {
  if (updates.length === 0) return media;
  const next = media.map((node) =>
    node && typeof node === "object" && !Array.isArray(node)
      ? { ...(node as Record<string, unknown>) }
      : node,
  );
  for (const { index, alt } of updates) {
    const node = next[index];
    if (!node || typeof node !== "object" || Array.isArray(node)) continue;
    next[index] = { ...node, alt };
  }
  return next;
}
