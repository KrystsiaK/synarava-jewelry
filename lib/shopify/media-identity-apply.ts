/**
 * Apply media identity leaves (removed / added / moved / alt).
 * Take-Shopify tree edits first via gallery.ts, then ONE push if any Keep-ours.
 */

import { db } from "@/lib/db";
import {
  applyGalleryOp,
  galleryFramePreviewUrl,
  parseLocalAssetId,
  readGalleryFrames,
  type GalleryOp,
} from "@/lib/products/gallery";
import {
  buildGalleryPlanFromWindow,
  type GalleryIdentityDiffKind,
} from "@/lib/shopify/gallery-plan";
import { pushProductToShopify } from "@/lib/shopify/product-sync";
import type { CatalogConflictDirection } from "@/lib/shopify/catalog-conflict";
import {
  gateWriteConvergence,
  intendedAddressFromLeaf,
  recheckEntityConflictLeaves,
} from "@/lib/sync";
import type { SyncLeaf } from "@/lib/sync/types";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function kindFromContractKey(contractKey: string | null | undefined): GalleryIdentityDiffKind | null {
  if (contractKey === "media.removed") return "removed";
  if (contractKey === "media.added") return "added";
  if (contractKey === "media.moved") return "moved";
  if (contractKey === "media.alt") return "alt";
  return null;
}

function frameIdFromPath(path: string | null | undefined): string | null {
  if (!path) return null;
  const idx = path.indexOf(":");
  if (idx < 0) return null;
  const id = path.slice(idx + 1).trim();
  return id || null;
}

function shopifyFrameNode(
  snapshot: unknown,
  frameId: string,
): { alt: string; url: string; width: number | null; height: number | null } | null {
  const frames = readGalleryFrames(
    isPlainObject(snapshot) && "media" in snapshot ? snapshot : { media: [] },
    snapshot,
  );
  const node = frames.find((frame) =>
    isPlainObject(frame) && frame.id === frameId,
  );
  if (!node || !isPlainObject(node)) return null;
  const url = galleryFramePreviewUrl(node);
  if (!url) return null;
  const preview = isPlainObject(node.preview) ? node.preview : null;
  const previewImage = preview && isPlainObject(preview.image) ? preview.image : null;
  const image = isPlainObject(node.image) ? node.image : null;
  const width = (previewImage && typeof previewImage.width === "number" ? previewImage.width : null)
    ?? (image && typeof image.width === "number" ? image.width : null);
  const height = (previewImage && typeof previewImage.height === "number" ? previewImage.height : null)
    ?? (image && typeof image.height === "number" ? image.height : null);
  return {
    alt: typeof node.alt === "string" ? node.alt : "",
    url,
    width,
    height,
  };
}

export type MediaIdentityApplyEntry = {
  fieldKey: string;
  label: string;
  path: string | null;
  contractKey: string | null;
  direction: CatalogConflictDirection;
  expectedLocalFingerprint: string;
  expectedShopifyFingerprint: string;
};

/**
 * Apply a batch of media identity choices for one product.
 * Order: Take-Shopify gallery ops → optional one Push → one convergence gate.
 */
export async function applyMediaIdentityBatch(input: {
  productId: string;
  entries: readonly MediaIdentityApplyEntry[];
  leavesBefore: readonly SyncLeaf[];
  requestedBy: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const product = await db.product.findUnique({
    where: { id: input.productId },
    select: { extras: true, shopifySnapshot: true },
  });
  if (!product) return { ok: false, message: "Product not found." };

  const takeShopifyOps: GalleryOp[] = [];
  let needsPush = false;

  const shopPlan = buildGalleryPlanFromWindow(product.shopifySnapshot);
  const ourPlan = buildGalleryPlanFromWindow(product.extras);

  for (const entry of input.entries) {
    const kind = kindFromContractKey(entry.contractKey);
    if (!kind) return { ok: false, message: `Unknown media contract ${entry.contractKey}.` };
    const frameId = frameIdFromPath(entry.path);
    const takeShopify = entry.direction === "SHOPIFY_TO_SYNARAVA";

    if (kind === "removed") {
      if (!frameId) return { ok: false, message: "Missing removed-photo frame id." };
      if (takeShopify) {
        const shopFrame = shopifyFrameNode(product.shopifySnapshot, frameId);
        if (!shopFrame) return { ok: false, message: "Shopify photo no longer exists." };
        const shopIndex = shopPlan.frames.findIndex((frame) => frame.frameId === frameId);
        takeShopifyOps.push({
          type: "insertShopify",
          frameId,
          toIndex: Math.max(0, shopIndex),
          alt: shopFrame.alt,
          url: shopFrame.url,
          width: shopFrame.width,
          height: shopFrame.height,
        });
      } else {
        needsPush = true;
      }
      continue;
    }

    if (kind === "added") {
      if (!frameId) return { ok: false, message: "Missing new-photo frame id." };
      if (takeShopify) {
        takeShopifyOps.push({ type: "remove", frameId });
      } else {
        needsPush = true;
      }
      continue;
    }

    if (kind === "moved") {
      if (takeShopify) {
        // Rebuild our order to match Shopify matched-gid order.
        const matched = shopPlan.frames
          .filter((frame) => ourPlan.frames.some((ours) => ours.frameId === frame.frameId));
        for (const [targetIndex, shopFrame] of matched.entries()) {
          takeShopifyOps.push({
            type: "move",
            frameId: shopFrame.frameId,
            toIndex: targetIndex,
          });
        }
      } else {
        needsPush = true;
      }
      continue;
    }

    if (kind === "alt") {
      if (!frameId) return { ok: false, message: "Missing photo-alt frame id." };
      if (takeShopify) {
        const shopFrame = shopPlan.frames.find((frame) => frame.frameId === frameId);
        takeShopifyOps.push({
          type: "setAlt",
          frameId,
          alt: shopFrame?.alt ?? "",
        });
      } else {
        needsPush = true;
      }
    }
  }

  try {
    for (const op of takeShopifyOps) {
      await applyGalleryOp(input.productId, op);
    }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Gallery could not be updated.",
    };
  }

  if (needsPush) {
    const pushed = await pushProductToShopify(input.productId, {
      authorizeCommerceConflictOverwrite: true,
      pushRegisteredTranslations: true,
    });
    if (!pushed.ok) {
      return { ok: false, message: pushed.error ?? "Media could not be pushed to Shopify." };
    }
  }

  const intended = input.leavesBefore
    .filter((leaf) => input.entries.some((entry) => entry.fieldKey === leaf.fieldKey))
    .map(intendedAddressFromLeaf);
  const gate = await gateWriteConvergence({
    resourceType: "PRODUCT",
    resourceId: input.productId,
    requestedBy: input.requestedBy,
    leavesBefore: input.leavesBefore,
    intended: intended.length > 0
      ? intended
      : input.entries.map((entry) => ({
          entityType: "PRODUCT" as const,
          entityId: input.productId,
          node: "base" as const,
          fieldKey: entry.fieldKey,
          label: entry.label,
        })),
  });
  if (!gate.ok) return { ok: false, message: gate.message };
  return { ok: true };
}

export async function loadLeavesBeforeMediaApply(
  productId: string,
  requestedBy: string,
): Promise<readonly SyncLeaf[]> {
  const { leaves } = await recheckEntityConflictLeaves({
    resourceType: "PRODUCT",
    resourceId: productId,
    requestedBy,
  });
  return leaves;
}

/** True when every entry is a media identity leaf (batchable). */
export function allMediaIdentityEntries(
  entries: ReadonlyArray<{ contractKey?: string | null }>,
): boolean {
  return entries.length > 0 && entries.every((entry) => kindFromContractKey(entry.contractKey) != null);
}

void parseLocalAssetId;
