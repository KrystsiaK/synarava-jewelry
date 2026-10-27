/**
 * ONE product gallery mechanism (ADR-0009 extras.media SoT).
 * Identity is frame id (Shopify gid or `local:<assetId>`), never array index.
 * All gallery writes go through `applyGalleryOp` inside one locked transaction.
 */

import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { getS3, getS3Bucket, getS3PublicUrl } from "@/lib/s3";

export const GALLERY_MAX_FRAMES = 250;
export const LOCAL_FRAME_PREFIX = "local:" as const;

export const GALLERY_ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);
export const GALLERY_MAX_BYTES = 10 * 1024 * 1024;

export type GalleryOp =
  | {
      type: "add";
      assetId: string;
      url: string;
      width: number | null;
      height: number | null;
      /** Default empty — never seed filename as alt. */
      alt?: string;
    }
  | { type: "remove"; frameId: string }
  | { type: "move"; frameId: string; toIndex: number }
  | { type: "setCover"; frameId: string }
  | { type: "setAlt"; frameId: string; alt: string };

export type GalleryFrameNode = {
  id: string;
  alt: string;
  mediaContentType: "IMAGE";
  preview: { image: { url: string; width: number | null; height: number | null } };
  image: { url: string; width: number | null; height: number | null };
};

export type GalleryApplyResult = {
  media: unknown[];
  coverUrl: string | null;
  coverAssetId: string | null;
};

export class GalleryOpError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GalleryOpError";
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function localFrameId(assetId: string): string {
  return `${LOCAL_FRAME_PREFIX}${assetId}`;
}

export function parseLocalAssetId(frameId: string): string | null {
  if (!frameId.startsWith(LOCAL_FRAME_PREFIX)) return null;
  const assetId = frameId.slice(LOCAL_FRAME_PREFIX.length).trim();
  return assetId || null;
}

export function isShopifyMediaGid(id: string): boolean {
  return id.startsWith("gid://shopify/");
}

export function validateGalleryUploadFile(file: File): string | null {
  if (!(file instanceof File) || file.size === 0) return "Choose an image to upload.";
  if (!file.type.startsWith("image/")) return "Only image uploads are supported.";
  // Browsers sometimes send image/jpg; sharp still accepts jpeg bytes.
  const mime = file.type === "image/jpg" ? "image/jpeg" : file.type;
  if (!GALLERY_ALLOWED_MIME.has(mime)) return "Use JPEG, PNG, WebP, or AVIF.";
  if (file.size > GALLERY_MAX_BYTES) return "Image must be 10 MB or smaller.";
  return null;
}

/** Preview / image URL from a Shopify-shaped media node. */
export function galleryFramePreviewUrl(node: unknown): string | null {
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

export function galleryFrameId(node: unknown): string | null {
  if (!isPlainObject(node) || typeof node.id !== "string" || !node.id.trim()) return null;
  return node.id;
}

function cloneFrame(node: unknown): unknown {
  if (!isPlainObject(node)) return node;
  return structuredClone(node);
}

function makeLocalFrame(input: {
  assetId: string;
  url: string;
  width: number | null;
  height: number | null;
  alt: string;
}): GalleryFrameNode {
  return {
    id: localFrameId(input.assetId),
    alt: input.alt,
    mediaContentType: "IMAGE",
    preview: { image: { url: input.url, width: input.width, height: input.height } },
    image: { url: input.url, width: input.width, height: input.height },
  };
}

/**
 * Read gallery frames. Prefer extras.media; if absent, seed from shopifySnapshot.media.
 * Never invent frames from ProductMedia here — callers append local frames via `add`.
 */
export function readGalleryFrames(extras: unknown, shopifySnapshot: unknown = null): unknown[] {
  if (isPlainObject(extras) && "media" in extras) {
    return Array.isArray(extras.media) ? extras.media.map(cloneFrame) : [];
  }
  if (isPlainObject(shopifySnapshot) && Array.isArray(shopifySnapshot.media)) {
    return shopifySnapshot.media.map(cloneFrame);
  }
  return [];
}

export type LocalGalleryRowSeed = {
  assetId: string;
  alt: string | null;
  url: string;
  width: number | null;
  height: number | null;
};

/**
 * Seed display frames when extras has no media key yet but local staging rows exist
 * (unlinked draft before the first gallery op). Does not invent Shopify GIDs.
 */
export function seedFramesFromLocalRows(
  rows: ReadonlyArray<LocalGalleryRowSeed>,
): GalleryFrameNode[] {
  return rows.map((row) =>
    makeLocalFrame({
      assetId: row.assetId,
      url: row.url,
      width: row.width,
      height: row.height,
      alt: typeof row.alt === "string" ? row.alt.trim() : "",
    }),
  );
}

/**
 * Resolve frames for any gallery mutation (including add / upload).
 * Prefer extras.media / snapshot; when empty, seed from existing ProductMedia rows.
 * Callers that will create a new ProductMedia row must resolve BEFORE that insert
 * so the new asset is not double-counted in the seed.
 */
export function resolveGalleryFramesForMutation(input: {
  extras: unknown;
  shopifySnapshot?: unknown;
  localRows: ReadonlyArray<LocalGalleryRowSeed>;
}): unknown[] {
  const frames = readGalleryFrames(input.extras, input.shopifySnapshot ?? null);
  if (frames.length > 0) return frames;
  if (input.localRows.length > 0) return seedFramesFromLocalRows(input.localRows);
  return [];
}

function findFrameIndex(frames: readonly unknown[], frameId: string): number {
  return frames.findIndex((node) => galleryFrameId(node) === frameId);
}

function coverMeta(frames: readonly unknown[]): {
  coverUrl: string | null;
  coverAssetId: string | null;
} {
  if (frames.length === 0) return { coverUrl: null, coverAssetId: null };
  const first = frames[0];
  const id = galleryFrameId(first);
  return {
    coverUrl: galleryFramePreviewUrl(first),
    coverAssetId: id ? parseLocalAssetId(id) : null,
  };
}

/**
 * Pure gallery op. Preserves every untouched frame id. Never reassigns a Shopify GID.
 * Never infers identity by preferred index / position.
 */
export function applyGalleryOpToFrames(
  frames: readonly unknown[],
  op: GalleryOp,
): GalleryApplyResult {
  const current = frames.map(cloneFrame);

  switch (op.type) {
    case "add": {
      if (current.length >= GALLERY_MAX_FRAMES) {
        throw new GalleryOpError("Shopify supports up to 250 media items per product.");
      }
      const id = localFrameId(op.assetId);
      if (findFrameIndex(current, id) >= 0) {
        throw new GalleryOpError("That image is already in the gallery.");
      }
      const next = [
        ...current,
        makeLocalFrame({
          assetId: op.assetId,
          url: op.url,
          width: op.width,
          height: op.height,
          alt: typeof op.alt === "string" ? op.alt.trim() : "",
        }),
      ];
      return { media: next, ...coverMeta(next) };
    }
    case "remove": {
      const index = findFrameIndex(current, op.frameId);
      if (index < 0) throw new GalleryOpError("Gallery image not found.");
      const next = current.filter((_, i) => i !== index);
      return { media: next, ...coverMeta(next) };
    }
    case "move": {
      const from = findFrameIndex(current, op.frameId);
      if (from < 0) throw new GalleryOpError("Gallery image not found.");
      if (!Number.isInteger(op.toIndex) || op.toIndex < 0 || op.toIndex >= current.length) {
        throw new GalleryOpError("Invalid gallery position.");
      }
      if (from === op.toIndex) return { media: current, ...coverMeta(current) };
      const next = [...current];
      const [item] = next.splice(from, 1);
      next.splice(op.toIndex, 0, item);
      return { media: next, ...coverMeta(next) };
    }
    case "setCover": {
      const from = findFrameIndex(current, op.frameId);
      if (from < 0) throw new GalleryOpError("Gallery image not found.");
      if (from === 0) return { media: current, ...coverMeta(current) };
      const next = [...current];
      const [item] = next.splice(from, 1);
      next.unshift(item);
      return { media: next, ...coverMeta(next) };
    }
    case "setAlt": {
      const index = findFrameIndex(current, op.frameId);
      if (index < 0) throw new GalleryOpError("Gallery image not found.");
      const node = current[index];
      if (!isPlainObject(node)) throw new GalleryOpError("Gallery image not found.");
      const next = [...current];
      next[index] = { ...node, alt: op.alt.trim() };
      return { media: next, ...coverMeta(next) };
    }
    default: {
      const _exhaustive: never = op;
      void _exhaustive;
      throw new GalleryOpError("Unknown gallery operation.");
    }
  }
}

export async function deleteStoredGalleryObject(storageKey: string): Promise<void> {
  await getS3().send(
    new DeleteObjectCommand({
      Bucket: getS3Bucket(),
      Key: storageKey,
    }),
  );
}

type LockedProduct = {
  id: string;
  shopifyProductId: string | null;
  extras: unknown;
  shopifySnapshot: unknown;
  primaryAssetId: string | null;
};

async function lockProduct(tx: Prisma.TransactionClient, productId: string): Promise<LockedProduct | null> {
  const rows = await tx.$queryRaw<Array<{
    id: string;
    shopifyProductId: string | null;
    extras: unknown;
    shopifySnapshot: unknown;
    primaryAssetId: string | null;
  }>>`
    SELECT id, "shopifyProductId", extras, "shopifySnapshot", "primaryAssetId"
    FROM "Product"
    WHERE id = ${productId}
    FOR UPDATE
  `;
  return rows[0] ?? null;
}

function extrasWithMedia(extras: unknown, media: unknown[]): Prisma.InputJsonValue {
  const base = isPlainObject(extras) ? { ...extras } : {};
  return { ...base, media } as Prisma.InputJsonValue;
}

async function syncLocalRowOrder(
  tx: Prisma.TransactionClient,
  productId: string,
  media: readonly unknown[],
): Promise<void> {
  const localAssetIds = media.flatMap((node) => {
    const id = galleryFrameId(node);
    if (!id) return [];
    const assetId = parseLocalAssetId(id);
    return assetId ? [assetId] : [];
  });

  if (localAssetIds.length === 0) return;

  const rows = await tx.productMedia.findMany({
    where: { productId, assetId: { in: localAssetIds } },
    select: { id: true, assetId: true },
  });
  const rowByAsset = new Map(rows.map((row) => [row.assetId, row.id]));

  for (const [sortOrder, assetId] of localAssetIds.entries()) {
    const rowId = rowByAsset.get(assetId);
    if (!rowId) continue;
    await tx.productMedia.update({
      where: { id: rowId },
      data: {
        sortOrder,
        kind: sortOrder === 0 ? "PRIMARY" : "GALLERY",
      },
    });
  }
}

async function loadFramesForOp(
  tx: Prisma.TransactionClient,
  product: LockedProduct,
): Promise<unknown[]> {
  // Seed legacy ProductMedia rows for EVERY op (including add / upload). Skipping
  // seed on add dropped existing draft frames from extras.media on first upload.
  const tree = readGalleryFrames(product.extras, product.shopifySnapshot);
  if (tree.length > 0) return tree;

  const localRows = await tx.productMedia.findMany({
    where: { productId: product.id },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      assetId: true,
      alt: true,
      asset: { select: { key: true, width: true, height: true } },
    },
  });
  return resolveGalleryFramesForMutation({
    extras: product.extras,
    shopifySnapshot: product.shopifySnapshot,
    localRows: localRows.map((row) => ({
      assetId: row.assetId,
      alt: row.alt,
      url: getS3PublicUrl(row.asset.key),
      width: row.asset.width,
      height: row.asset.height,
    })),
  });
}

async function persistGalleryResult(
  tx: Prisma.TransactionClient,
  product: LockedProduct,
  op: GalleryOp,
  result: GalleryApplyResult,
): Promise<void> {
  if (op.type === "remove") {
    const assetId = parseLocalAssetId(op.frameId);
    if (assetId) {
      await tx.productMedia.deleteMany({ where: { productId: product.id, assetId } });
    }
  }

  if (op.type === "setAlt") {
    const assetId = parseLocalAssetId(op.frameId);
    if (assetId) {
      const nextAlt = op.alt.trim() || null;
      await tx.productMedia.updateMany({
        where: { productId: product.id, assetId },
        data: { alt: nextAlt },
      });
      await tx.mediaAsset.updateMany({
        where: { id: assetId },
        data: { alt: nextAlt },
      });
    }
  }

  if (op.type === "add" || op.type === "move" || op.type === "setCover" || op.type === "remove") {
    await syncLocalRowOrder(tx, product.id, result.media);
  }

  await tx.product.update({
    where: { id: product.id },
    data: {
      extras: extrasWithMedia(product.extras, result.media),
      imageUrl: result.coverUrl,
      primaryAssetId: result.coverAssetId,
      ...(product.shopifyProductId
        ? { syncStatus: "PENDING" as const, syncError: null }
        : {}),
    },
  });
}

/**
 * Apply one gallery op under a product row lock. Sole writer of extras.media.
 */
export async function applyGalleryOp(
  productId: string,
  op: GalleryOp,
): Promise<GalleryApplyResult> {
  return db.$transaction(async (tx) => {
    const product = await lockProduct(tx, productId);
    if (!product) throw new GalleryOpError("Product not found.");

    const frames = await loadFramesForOp(tx, product);
    if (op.type === "add" && frames.length >= GALLERY_MAX_FRAMES) {
      throw new GalleryOpError("Shopify supports up to 250 media items per product.");
    }

    const result = applyGalleryOpToFrames(frames, op);
    await persistGalleryResult(tx, product, op, result);
    return result;
  });
}

export type GalleryUploadCommitInput = {
  productId: string;
  storageKey: string;
  filename: string;
  mimeType: string;
  extension: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  publicPath: string;
  uploadedByUsername?: string | null;
};

/**
 * Create MediaAsset + ProductMedia staging row and append `local:<assetId>` in ONE locked tx.
 */
export async function commitGalleryUpload(
  input: GalleryUploadCommitInput,
): Promise<GalleryApplyResult & { assetId: string }> {
  return db.$transaction(async (tx) => {
    const product = await lockProduct(tx, input.productId);
    if (!product) throw new GalleryOpError("Product not found.");

    // Seed existing ProductMedia BEFORE inserting the new asset so the new row
    // is not double-counted in the legacy seed list.
    const frames = await loadFramesForOp(tx, product);
    if (frames.length >= GALLERY_MAX_FRAMES) {
      throw new GalleryOpError("Shopify supports up to 250 media items per product.");
    }

    const asset = await tx.mediaAsset.create({
      data: {
        key: input.storageKey,
        filename: input.filename,
        mimeType: input.mimeType,
        extension: input.extension.replace(/^\./, ""),
        sizeBytes: input.sizeBytes,
        width: input.width,
        height: input.height,
        bucket: getS3Bucket(),
        source: "UPLOAD",
        status: "READY",
        uploadedByUsername: input.uploadedByUsername ?? null,
        alt: null,
      },
      select: { id: true },
    });

    const last = await tx.productMedia.findFirst({
      where: { productId: input.productId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    await tx.productMedia.create({
      data: {
        productId: input.productId,
        assetId: asset.id,
        kind: "GALLERY",
        alt: null,
        sortOrder: (last?.sortOrder ?? -1) + 1,
      },
    });

    const op: GalleryOp = {
      type: "add",
      assetId: asset.id,
      url: input.publicPath,
      width: input.width,
      height: input.height,
      alt: "",
    };
    const result = applyGalleryOpToFrames(frames, op);
    await persistGalleryResult(tx, product, op, result);
    return { ...result, assetId: asset.id };
  });
}
