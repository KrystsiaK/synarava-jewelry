import "server-only";

import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { revalidateStorefrontPath, revalidateStorefrontTemplate } from "@/lib/content/revalidate-storefront";
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

export type ConflictEntity = "product" | "collection";

const CONFLICT_ACTION_ERRORS = {
  shopifyNotConfigured: "Shopify Admin API credentials are not configured.",
  previewFailed: "Could not preview the conflict resolution.",
  applyFailed: "Could not apply the conflict resolution.",
  signalsFailed: "Could not load conflict status.",
} as const;

function conflictApplyMessages(appliedCount: number, failedCount: number): {
  success?: string;
  error?: string;
} {
  return {
    success: appliedCount > 0
      ? `${appliedCount} change${appliedCount === 1 ? "" : "s"} applied${failedCount > 0 ? `; ${failedCount} could not be applied` : ""}.`
      : undefined,
    error: appliedCount === 0
      ? "None of the selected changes could be applied. Review the results below."
      : undefined,
  };
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

function err(error: unknown, fallback: string) {
  return { error: error instanceof Error ? error.message : fallback };
}

function revalidateConflictStorefront() {
  revalidateStorefrontPath("/");
  revalidateStorefrontPath("/shop");
  revalidateStorefrontPath("/collections");
  revalidateStorefrontTemplate("/collections/[slug]");
  revalidateStorefrontTemplate("/products/[slug]");
  revalidateStorefrontPath("/about");
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

function finishApply<T extends { appliedCount: number; failedCount: number }>(
  entity: ConflictEntity,
  outcome: T,
  adminPaths: string[],
  warning?: string,
): ConflictApplyResult<T> {
  // Fire-and-forget cache work after the response path (same as pre-refactor).
  after(() => {
    revalidateConflictStorefront();
    for (const path of adminPaths) revalidatePath(path);
  });
  const messages = conflictApplyMessages(outcome.appliedCount, outcome.failedCount);
  if (entity === "product") return { outcome, warning, ...messages };
  return { outcome, ...messages };
}

export async function loadSignals(entity: ConflictEntity, username: string): Promise<ConflictSignalsResult> {
  try {
    const signals = entity === "product"
      ? await getCatalogConflictSignals(username)
      : await getCollectionConflictSignals();
    return { signals };
  } catch (error) {
    return err(error, CONFLICT_ACTION_ERRORS.signalsFailed);
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
  if (!hasShopifyAdminConfig()) return { error: CONFLICT_ACTION_ERRORS.shopifyNotConfigured };
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
    return err(error, CONFLICT_ACTION_ERRORS.previewFailed);
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
  if (!hasShopifyAdminConfig()) return { error: CONFLICT_ACTION_ERRORS.shopifyNotConfigured };
  try {
    if (entity === "product") {
      const productInput = input as { entries: CatalogConflictApplyEntryInput[]; acknowledgeClears: boolean };
      const outcome = await applyCatalogConflictResolution({ ...productInput, actorUsername: username });
      const warning = await markProductIncomingWatermark(productInput.entries, outcome);
      if (outcome.appliedCount > 0) await runAfterSaveCatalogConflictCheck(username);
      return finishApply(entity, outcome, ["/admin/products"], warning);
    }

    const collectionInput = input as {
      entries: CollectionConflictApplyEntryInput[];
      acknowledgeClears: boolean;
    };
    const outcome = await applyCollectionConflictResolution({ ...collectionInput, actorUsername: username });
    if (outcome.appliedCount > 0) await runAfterSaveCatalogConflictCheck(username);
    const adminPaths = [
      "/admin/collections",
      ...[...new Set(collectionInput.entries.map((entry) => entry.collectionId))].map(
        (id) => `/admin/collections/${id}`,
      ),
    ];
    return finishApply(entity, outcome, adminPaths);
  } catch (error) {
    return err(error, CONFLICT_ACTION_ERRORS.applyFailed);
  }
}
