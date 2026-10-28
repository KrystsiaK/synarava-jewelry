/**
 * ONE gallery plan: ordered frames by identity (gid / local:assetId).
 * Single source for push productSet.files, identity compare, and Media tab reads.
 * Preview URLs are display-only — never enter compare, fingerprints, or contract keys.
 */

import {
  galleryFrameId,
  galleryFramePreviewUrl,
  isShopifyMediaGid,
  parseLocalAssetId,
  readGalleryFrames,
  seedFramesFromLocalRows,
  type LocalGalleryRowSeed,
} from "@/lib/products/gallery";
import { shopifyMediaFilename } from "@/lib/shopify/staged-product-media";

export type GalleryFrameSource = "shopify-gid" | "pending-upload";

export type GalleryPlanFrame = {
  frameId: string;
  source: GalleryFrameSource;
  alt: string;
  position: number;
  /** Display only — never compared or fingerprinted. */
  previewUrl: string | null;
  filename: string | null;
};

export type GalleryPlan = {
  frames: readonly GalleryPlanFrame[];
};

export type GalleryIdentityDiffKind = "removed" | "added" | "moved" | "alt";

export type GalleryIdentityDiff = {
  kind: GalleryIdentityDiffKind;
  /** Matched / subject frame id; null for the single "moved" leaf. */
  frameId: string | null;
  contractKey: string;
  path: string;
  label: string;
  synaravaValue: string;
  shopifyValue: string;
  /** Display-only thumbnail (prefer Shopify side, else ours). */
  previewUrl: string | null;
  fingerprintLocal: string;
  fingerprintShopify: string;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** Human label: alt, else clean filename basename — never a storage path. */
export function galleryHumanLabel(input: {
  alt?: string | null;
  filename?: string | null;
  frameId?: string | null;
}): string {
  const alt = typeof input.alt === "string" ? input.alt.trim() : "";
  if (alt) return alt;
  const filename = typeof input.filename === "string" ? input.filename.trim() : "";
  if (filename) {
    const base = filename.split(/[/\\]/).pop() ?? filename;
    return base || "Photo";
  }
  const id = input.frameId?.trim() ?? "";
  if (id.startsWith("local:")) return "New photo";
  if (isShopifyMediaGid(id)) {
    const tail = id.split("/").pop();
    return tail ? `Photo ${tail}` : "Photo";
  }
  return "Photo";
}

function frameFilename(node: unknown, previewUrl: string | null): string | null {
  if (!isPlainObject(node)) return null;
  if (typeof node.filename === "string" && node.filename.trim()) return node.filename.trim();
  const originalSource = isPlainObject(node.originalSource) ? node.originalSource : null;
  return shopifyMediaFilename({
    originalSourceUrl: originalSource && typeof originalSource.url === "string"
      ? originalSource.url
      : null,
    imageUrl: previewUrl,
  });
}

function frameAlt(node: unknown): string {
  if (!isPlainObject(node) || typeof node.alt !== "string") return "";
  return node.alt.trim();
}

/** Build an ordered plan from Shopify-shaped media nodes (OUR tree or snapshot). */
export function buildGalleryPlanFromNodes(media: readonly unknown[] | null | undefined): GalleryPlan {
  if (!media) return { frames: [] };
  const frames: GalleryPlanFrame[] = [];
  for (const node of media) {
    const frameId = galleryFrameId(node);
    if (!frameId) continue;
    const previewUrl = galleryFramePreviewUrl(node);
    const source: GalleryFrameSource = isShopifyMediaGid(frameId) ? "shopify-gid" : "pending-upload";
    if (source === "pending-upload" && !parseLocalAssetId(frameId)) continue;
    frames.push({
      frameId,
      source,
      alt: frameAlt(node),
      position: frames.length,
      previewUrl,
      filename: frameFilename(node, previewUrl),
    });
  }
  return { frames };
}

/** Plan from a commerce window / extras object (`media` key or empty). */
export function buildGalleryPlanFromWindow(windowOrExtras: unknown): GalleryPlan {
  const nodes = readGalleryFrames(windowOrExtras, null);
  // readGalleryFrames seeds from snapshot when extras has no media key — for
  // compare we pass each side's own window, so only that window's media counts.
  if (isPlainObject(windowOrExtras) && !("media" in windowOrExtras)) {
    return { frames: [] };
  }
  return buildGalleryPlanFromNodes(nodes);
}

/**
 * ONE gallery plan for a product row — Push, compare, and Media tab.
 * Prefer extras.media; else shopifySnapshot; else local ProductMedia staging rows.
 */
export function buildGalleryPlan(product: {
  extras?: unknown;
  shopifySnapshot?: unknown;
  media?: ReadonlyArray<LocalGalleryRowSeed> | null;
}): GalleryPlan {
  const tree = readGalleryFrames(product.extras ?? null, product.shopifySnapshot ?? null);
  const nodes =
    tree.length > 0
      ? tree
      : seedFramesFromLocalRows(product.media ?? []);
  return buildGalleryPlanFromNodes(nodes);
}

/**
 * Identity compare: match by frameId (Shopify gid). `local:` frames never match.
 * Emits independent diffs — never positional replace/cascade.
 */
export function diffGalleryByIdentity(
  ours: GalleryPlan,
  shopify: GalleryPlan,
): GalleryIdentityDiff[] {
  const ourById = new Map(ours.frames.map((frame) => [frame.frameId, frame] as const));
  const shopById = new Map(shopify.frames.map((frame) => [frame.frameId, frame] as const));
  const diffs: GalleryIdentityDiff[] = [];

  for (const shopFrame of shopify.frames) {
    if (ourById.has(shopFrame.frameId)) continue;
    const label = galleryHumanLabel(shopFrame);
    diffs.push({
      kind: "removed",
      frameId: shopFrame.frameId,
      contractKey: "media.removed",
      path: `media.removed:${shopFrame.frameId}`,
      label: `Removed photo · ${label}`,
      synaravaValue: "— not in Synarava —",
      shopifyValue: label,
      previewUrl: shopFrame.previewUrl,
      fingerprintLocal: "absent",
      fingerprintShopify: shopFrame.frameId,
    });
  }

  for (const ourFrame of ours.frames) {
    if (shopById.has(ourFrame.frameId)) continue;
    const label = galleryHumanLabel(ourFrame);
    diffs.push({
      kind: "added",
      frameId: ourFrame.frameId,
      contractKey: "media.added",
      path: `media.added:${ourFrame.frameId}`,
      label: `New photo · ${label}`,
      synaravaValue: label,
      shopifyValue: "— not in Shopify —",
      previewUrl: ourFrame.previewUrl,
      fingerprintLocal: ourFrame.frameId,
      fingerprintShopify: "absent",
    });
  }

  const matchedShopOrder = shopify.frames
    .filter((frame) => ourById.has(frame.frameId))
    .map((frame) => frame.frameId);
  const matchedOurOrder = ours.frames
    .filter((frame) => shopById.has(frame.frameId))
    .map((frame) => frame.frameId);
  if (
    matchedShopOrder.length > 1
    && matchedShopOrder.join("\0") !== matchedOurOrder.join("\0")
  ) {
    diffs.push({
      kind: "moved",
      frameId: null,
      contractKey: "media.moved",
      path: "media.moved",
      label: "Photo order",
      synaravaValue: matchedOurOrder.map((id) => galleryHumanLabel(ourById.get(id)!)).join(" → "),
      shopifyValue: matchedShopOrder.map((id) => galleryHumanLabel(shopById.get(id)!)).join(" → "),
      previewUrl: ourById.get(matchedOurOrder[0]!)?.previewUrl
        ?? shopById.get(matchedShopOrder[0]!)?.previewUrl
        ?? null,
      fingerprintLocal: matchedOurOrder.join("|"),
      fingerprintShopify: matchedShopOrder.join("|"),
    });
  }

  for (const shopFrame of shopify.frames) {
    const ourFrame = ourById.get(shopFrame.frameId);
    if (!ourFrame) continue;
    if (ourFrame.alt === shopFrame.alt) continue;
    const label = galleryHumanLabel({
      alt: ourFrame.alt || shopFrame.alt,
      filename: ourFrame.filename ?? shopFrame.filename,
      frameId: shopFrame.frameId,
    });
    diffs.push({
      kind: "alt",
      frameId: shopFrame.frameId,
      contractKey: "media.alt",
      path: `media.alt:${shopFrame.frameId}`,
      label: `Photo alt · ${label}`,
      synaravaValue: ourFrame.alt || "— empty —",
      shopifyValue: shopFrame.alt || "— empty —",
      previewUrl: ourFrame.previewUrl ?? shopFrame.previewUrl,
      fingerprintLocal: `${shopFrame.frameId}|${ourFrame.alt}`,
      fingerprintShopify: `${shopFrame.frameId}|${shopFrame.alt}`,
    });
  }

  return diffs.toSorted((a, b) => a.path.localeCompare(b.path) || a.kind.localeCompare(b.kind));
}

export type ProductSetFileInput = {
  id?: string;
  originalSource?: string;
  alt: string;
  filename?: string;
  contentType?: "IMAGE";
};

/**
 * Build productSet `files` ONLY from the plan.
 * gid frames → { id, alt }; pending → { originalSource, filename } via resolvePending.
 * Dedupes by frameId. Create-with-imageUrl-only is handled by the caller when plan is empty.
 */
export function productSetFilesFromPlan(
  plan: GalleryPlan,
  resolvePending: (frame: GalleryPlanFrame) => {
    originalSource: string;
    filename: string;
  } | null,
): ProductSetFileInput[] {
  const seen = new Set<string>();
  const files: ProductSetFileInput[] = [];
  for (const frame of plan.frames) {
    if (seen.has(frame.frameId)) continue;
    seen.add(frame.frameId);
    if (frame.source === "shopify-gid") {
      files.push({ id: frame.frameId, alt: frame.alt });
      continue;
    }
    const pending = resolvePending(frame);
    if (!pending) {
      throw new Error(`Missing staging URL for gallery frame ${frame.frameId}.`);
    }
    files.push({
      originalSource: pending.originalSource,
      filename: pending.filename,
      contentType: "IMAGE",
      alt: frame.alt,
    });
  }
  return files;
}

/** Stable ids for productSet dedupe guards (gid / filename / assetId). */
export function productSetFileIdentityKeys(files: readonly ProductSetFileInput[]): string[] {
  return files.map((file) => {
    if (file.id) return `id:${file.id}`;
    if (file.filename) return `file:${file.filename}`;
    if (file.originalSource) return `src:${file.originalSource.split("?")[0]}`;
    return `alt:${file.alt}`;
  });
}
