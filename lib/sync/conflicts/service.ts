import "server-only";

import { revalidatePath } from "next/cache";

import { revalidateStorefront } from "@/lib/content/revalidate-storefront";
import { hasShopifyAdminConfig } from "@/lib/shopify/admin";
import { runAfterSaveCatalogConflictCheck } from "@/lib/shopify/after-save-catalog-check";
import {
  applyCatalogConflictResolution,
  previewCatalogConflictResolution,
  type CatalogConflictApplyEntryInput,
  type CatalogConflictApplyOutcome,
  type CatalogConflictApplyScope,
  type CatalogConflictPreview,
} from "@/lib/shopify/catalog-conflict-apply";
import { loadProductConflictFromSyncResult } from "@/lib/shopify/catalog-conflict";
import { markIncomingProductUpdates } from "@/lib/shopify/catalog-conflict-review";
import type { CatalogConflictSignals } from "@/lib/shopify/catalog-conflict-signals";
import {
  getCatalogConflictSignals,
  getCollectionConflictSignals,
  runProductConflictCheck,
} from "@/lib/shopify/catalog-conflict-signals-server";
import {
  applyCollectionConflictResolution,
  previewCollectionConflictResolution,
  type CollectionConflictApplyEntryInput,
  type CollectionConflictApplyOutcome,
  type CollectionConflictApplyScope,
  type CollectionConflictPreview,
} from "@/lib/shopify/collection-conflict-apply";
import { loadCollectionConflictFromSyncResult } from "@/lib/shopify/collection-conflict";

export type ConflictEntity = "product" | "collection";

const ERRORS = {
  shopifyNotConfigured: "Shopify Admin API credentials are not configured.",
  previewFailed: "Could not preview the conflict resolution.",
  applyFailed: "Could not apply the conflict resolution.",
  signalsFailed: "Could not load conflict status.",
  productConflictFailed: "Could not load this product's conflict details.",
  collectionConflictFailed: "Could not load this collection's conflict details.",
} as const;

function applyMessages(appliedCount: number, failedCount: number) {
  return {
    success: appliedCount > 0
      ? `${appliedCount} change${appliedCount === 1 ? "" : "s"} applied${failedCount > 0 ? `; ${failedCount} could not be applied` : ""}.`
      : undefined,
    error: appliedCount === 0
      ? "None of the selected changes could be applied. Review the results below."
      : undefined,
  };
}

/** Local entity ids that Apply wrote successfully (skip virtual shopify:* rows). */
function appliedEntityIds(
  results: Array<{ ok: boolean; productId?: string; collectionId?: string; localProductId?: string; localCollectionId?: string }>,
  entity: ConflictEntity,
): string[] {
  return [...new Set(
    results
      .filter((result) => result.ok)
      .map((result) => entity === "product"
        ? (result.localProductId ?? result.productId)
        : (result.localCollectionId ?? result.collectionId))
      .filter((id): id is string => typeof id === "string" && !id.startsWith("shopify:")),
  )];
}

/** Optional-field shape preserves prior server-action caller checks (`if (result.signals)`). */
export type ConflictSignalsResult = { signals?: CatalogConflictSignals; error?: string };
export type ConflictPreviewResult<T> = { preview?: T; error?: string };
export type ConflictApplyResult<T> = {
  outcome?: T;
  warning?: string;
  success?: string;
  error?: string;
};
export type ConflictEntityLoadResult = { conflict?: unknown; error?: string };

function err(error: unknown, fallback: string) {
  return { error: error instanceof Error ? error.message : fallback };
}

async function markProductIncomingWatermark(
  entries: CatalogConflictApplyEntryInput[],
  outcome: CatalogConflictApplyOutcome,
): Promise<string | undefined> {
  const incomingProductIds = new Set(
    outcome.results
      .filter((result) => result.ok && entries.some((entry) =>
        entry.productId === result.productId
        && entry.fieldKey === result.fieldKey
        && entry.direction === "SHOPIFY_TO_SYNARAVA",
      ))
      .map((result) => result.localProductId ?? result.productId)
      .filter((productId) => Boolean(productId) && !productId.startsWith("shopify:")),
  );
  try {
    await markIncomingProductUpdates([...incomingProductIds]);
  } catch (error) {
    console.error("[catalog-conflicts] applied values but could not record the review watermark", error);
    return "Values were applied, but the new-from-Shopify review badge could not be saved.";
  }
}

/**
 * Invalidate caches at the write — never after a long recheck.
 * If the request is cut during recheck, DB already changed; caches must not stay stale.
 * Do not defer storefront invalidation to after() (safe-to-lose only).
 */
function invalidateAfterWrite(adminPaths: string[]) {
  for (const path of adminPaths) revalidatePath(path);
  revalidateStorefront();
}

function finishApply<T extends { appliedCount: number; failedCount: number }>(
  entity: ConflictEntity,
  outcome: T,
  warning?: string,
): ConflictApplyResult<T> {
  const messages = applyMessages(outcome.appliedCount, outcome.failedCount);
  return entity === "product" ? { outcome, warning, ...messages } : { outcome, ...messages };
}

/** Scoped recheck after Apply — never throws into Apply (caches already invalidated). */
async function recheckAppliedEntities(
  username: string,
  entity: ConflictEntity,
  ids: string[],
): Promise<void> {
  for (const id of ids) {
    try {
      await runAfterSaveCatalogConflictCheck(
        username,
        entity === "product"
          ? { kind: "product", productId: id }
          : { kind: "collection", collectionId: id },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[conflict-apply] scoped recheck failed after write for ${entity} ${id}`, message);
    }
  }
}

export async function loadSignals(entity: ConflictEntity, username: string): Promise<ConflictSignalsResult> {
  try {
    const signals = entity === "product"
      ? await getCatalogConflictSignals(username)
      : await getCollectionConflictSignals();
    return { signals };
  } catch (error) {
    return err(error, ERRORS.signalsFailed);
  }
}

/** Display-only SyncResult leaf map (skipRefresh) — no Shopify fetch. */
export async function loadEntityConflict(
  entity: "product",
  entityId: string,
  username: string,
): Promise<{ conflict?: Awaited<ReturnType<typeof loadProductConflictFromSyncResult>>; error?: string }>;
export async function loadEntityConflict(
  entity: "collection",
  entityId: string,
  username: string,
): Promise<{ conflict?: Awaited<ReturnType<typeof loadCollectionConflictFromSyncResult>>; error?: string }>;
export async function loadEntityConflict(
  entity: ConflictEntity,
  entityId: string,
  username: string,
): Promise<ConflictEntityLoadResult> {
  if (!hasShopifyAdminConfig()) return { error: ERRORS.shopifyNotConfigured };
  try {
    if (entity === "product") {
      return {
        conflict: await loadProductConflictFromSyncResult(entityId, {
          requestedBy: username,
          skipRefresh: true,
        }),
      };
    }
    return {
      conflict: await loadCollectionConflictFromSyncResult(entityId, {
        requestedBy: username,
        skipRefresh: true,
      }),
    };
  } catch (error) {
    return err(error, entity === "product" ? ERRORS.productConflictFailed : ERRORS.collectionConflictFailed);
  }
}

export async function previewResolution(
  entity: "product",
  scope: CatalogConflictApplyScope,
  username: string,
): Promise<ConflictPreviewResult<CatalogConflictPreview>>;
export async function previewResolution(
  entity: "collection",
  scope: CollectionConflictApplyScope,
  username: string,
): Promise<ConflictPreviewResult<CollectionConflictPreview>>;
export async function previewResolution(
  entity: ConflictEntity,
  scope: CatalogConflictApplyScope | CollectionConflictApplyScope,
  username: string,
): Promise<ConflictPreviewResult<CatalogConflictPreview | CollectionConflictPreview>> {
  if (!hasShopifyAdminConfig()) return { error: ERRORS.shopifyNotConfigured };
  try {
    if (entity === "product") {
      const productScope = scope as CatalogConflictApplyScope;
      if (productScope.kind === "PRODUCT" && !productScope.productId.startsWith("shopify:")) {
        const checked = await runProductConflictCheck({
          productId: productScope.productId,
          requestedBy: username,
        });
        if (checked.warning) return { error: checked.warning };
      }
      return { preview: await previewCatalogConflictResolution(productScope, { requestedBy: username }) };
    }
    return {
      preview: await previewCollectionConflictResolution(
        scope as CollectionConflictApplyScope,
        { requestedBy: username },
      ),
    };
  } catch (error) {
    return err(error, ERRORS.previewFailed);
  }
}

export async function applyResolution(
  entity: "product",
  input: { entries: CatalogConflictApplyEntryInput[]; acknowledgeClears: boolean },
  username: string,
): Promise<ConflictApplyResult<CatalogConflictApplyOutcome>>;
export async function applyResolution(
  entity: "collection",
  input: { entries: CollectionConflictApplyEntryInput[]; acknowledgeClears: boolean },
  username: string,
): Promise<ConflictApplyResult<CollectionConflictApplyOutcome>>;
export async function applyResolution(
  entity: ConflictEntity,
  input: {
    entries: Array<CatalogConflictApplyEntryInput | CollectionConflictApplyEntryInput>;
    acknowledgeClears: boolean;
  },
  username: string,
): Promise<ConflictApplyResult<CatalogConflictApplyOutcome | CollectionConflictApplyOutcome>> {
  if (!hasShopifyAdminConfig()) return { error: ERRORS.shopifyNotConfigured };
  try {
    if (entity === "product") {
      const productInput = input as { entries: CatalogConflictApplyEntryInput[]; acknowledgeClears: boolean };
      const outcome = await applyCatalogConflictResolution({ ...productInput, actorUsername: username });
      // Write phase done — invalidate before any recheck (recheck must not gate caches).
      invalidateAfterWrite(["/admin/products"]);
      const warning = await markProductIncomingWatermark(productInput.entries, outcome);
      if (outcome.appliedCount > 0) {
        await recheckAppliedEntities(username, "product", appliedEntityIds(outcome.results, "product"));
      }
      return finishApply(entity, outcome, warning);
    }

    const collectionInput = input as {
      entries: CollectionConflictApplyEntryInput[];
      acknowledgeClears: boolean;
    };
    const outcome = await applyCollectionConflictResolution({ ...collectionInput, actorUsername: username });
    const adminPaths = [
      "/admin/collections",
      ...[...new Set(collectionInput.entries.map((e) => e.collectionId))].map((id) => `/admin/collections/${id}`),
    ];
    invalidateAfterWrite(adminPaths);
    if (outcome.appliedCount > 0) {
      await recheckAppliedEntities(username, "collection", appliedEntityIds(outcome.results, "collection"));
    }
    return finishApply(entity, outcome);
  } catch (error) {
    return err(error, ERRORS.applyFailed);
  }
}
