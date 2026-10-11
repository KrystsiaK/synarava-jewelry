/**
 * Gallery alt FormData keys used by ProductMediaManager.
 * Local rows: `media-alt-{productMediaId}`
 * OUR tree frames (no local rows): `media-alt-tree-{index}`
 *
 * Distinct per-image alts are SoT in ProductMedia (staging) and/or
 * workingSnapshot.media (OUR commerce tree). Never broadcast the product title
 * onto every image on Push/Save — that collapses unique alts (Soleil Lemon bug).
 */

export type LocalMediaAltFormUpdate = { mediaId: string; alt: string };
export type TreeMediaAltFormUpdate = { index: number; alt: string };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function trimAlt(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** FormData / input names owned by the Media gallery alt editors. */
export function isMediaAltFormField(name: string): boolean {
  return name.startsWith("media-alt-");
}

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

/** Raw per-index alts from OUR window — empty string when missing (no `Image N` placeholder). */
export function rawMediaAltsFromWorkingSnapshot(workingSnapshot: unknown): string[] {
  if (!isPlainObject(workingSnapshot)) return [];
  const media = workingSnapshot.media;
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

export type LocalMediaRowForWorkingMerge = {
  assetId: string;
  alt: string | null;
  url: string;
  width: number | null;
  height: number | null;
};

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
 * Remove one OUR-tree media frame by index (immutable).
 * Returns null when the index is out of range.
 */
export function removeWorkingSnapshotMediaAtIndex(
  media: unknown[],
  mediaIndex: number,
): unknown[] | null {
  if (!Number.isInteger(mediaIndex) || mediaIndex < 0 || mediaIndex >= media.length) {
    return null;
  }
  return media.filter((_, index) => index !== mediaIndex);
}

/**
 * OUR-tree media nodes when the window has a `media` key.
 * - `null` — no `media` key (legacy: do not treat tree as SoT).
 * - `unknown[]` — tree is SoT (may be empty after intentional clear).
 */
export function workingSnapshotMediaNodes(workingSnapshot: unknown): unknown[] | null {
  if (!isPlainObject(workingSnapshot) || !("media" in workingSnapshot)) return null;
  return Array.isArray(workingSnapshot.media) ? workingSnapshot.media : [];
}

/**
 * Shopify media GIDs retained on Push from OUR `workingSnapshot.media`.
 * - `null` — no `media` key on the window (legacy: do not treat tree as SoT).
 * - `string[]` — tree is SoT; remote media not listed must be omitted from
 *   `productSet.files` so Shopify deletes them (list-field semantics).
 */
export function retainedShopifyMediaIdsFromWorkingSnapshot(
  workingSnapshot: unknown,
): string[] | null {
  const media = workingSnapshotMediaNodes(workingSnapshot);
  if (media == null) return null;
  return media.flatMap((node) => {
    if (!isPlainObject(node) || typeof node.id !== "string") return [];
    return node.id.startsWith("gid://shopify/") ? [node.id] : [];
  });
}

function findPriorMediaIndex(input: {
  baseMedia: unknown[];
  url: string;
  preferredIndex: number;
  used: ReadonlySet<number>;
}): number {
  const byUrl = input.baseMedia.findIndex((node, index) => {
    if (input.used.has(index)) return false;
    return mediaNodePreviewUrl(node) === input.url;
  });
  if (byUrl >= 0) return byUrl;

  if (
    input.preferredIndex < input.baseMedia.length
    && !input.used.has(input.preferredIndex)
  ) {
    return input.preferredIndex;
  }

  return input.baseMedia.findIndex((_, index) => !input.used.has(index));
}

/**
 * Build Shopify-shaped media for Save write-through.
 * Prefer non-empty local alts; otherwise keep the matched prior OUR-tree alt
 * so empty staging rows cannot wipe distinct tree edits.
 * Intentional: output length follows `localRows` (staging gallery is SoT when present);
 * extra `baseMedia` entries are dropped. Priors match by URL first so remove/reorder
 * keeps the correct Shopify media `id` (index-only match reassigned deleted slots).
 */
export function mergeLocalMediaRowsIntoWorkingMedia(input: {
  localRows: ReadonlyArray<LocalMediaRowForWorkingMerge>;
  baseMedia: unknown[];
}): unknown[] {
  const usedPrior = new Set<number>();
  return input.localRows.map((item, index) => {
    const priorIndex = findPriorMediaIndex({
      baseMedia: input.baseMedia,
      url: item.url,
      preferredIndex: index,
      used: usedPrior,
    });
    if (priorIndex >= 0) usedPrior.add(priorIndex);
    const prior = priorIndex >= 0 ? input.baseMedia[priorIndex] : undefined;
    const priorAlt = isPlainObject(prior) ? trimAlt(prior.alt) : "";
    const localAlt = trimAlt(item.alt);
    const priorId = isPlainObject(prior) && typeof prior.id === "string" ? prior.id : null;
    return {
      id: priorId ?? `local:${item.assetId}`,
      alt: localAlt || priorAlt,
      mediaContentType: "IMAGE",
      preview: { image: { url: item.url, width: item.width, height: item.height } },
      image: { url: item.url, width: item.width, height: item.height },
    };
  });
}
