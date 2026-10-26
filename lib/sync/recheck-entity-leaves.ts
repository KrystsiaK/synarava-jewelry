/**
 * Apply / preview safety recheck — refresh Shopify for ONE entity, then the
 * same compare as the list (`compareSyncState` → SyncResult leaves).
 * No second commerce compare (`inspectProductSyncState.differences`).
 */

import "server-only";

import type { SyncLeaf, SyncResourceType } from "./types";
import { runSyncWaterfall } from "./waterfall";

export type RecheckEntityConflictLeavesInput = {
  resourceType: Extract<SyncResourceType, "PRODUCT" | "COLLECTION">;
  resourceId: string;
  requestedBy: string;
};

export type RecheckEntityConflictLeavesResult = {
  leaves: readonly SyncLeaf[];
  warning?: string;
};

/**
 * Refresh Shopify window(s) for one product/collection, read Synarava, compare
 * once via the waterfall. Callers match leaves by fieldKey / label and check
 * fingerprints — STALE when the leaf is gone or fingerprints drifted.
 */
export async function recheckEntityConflictLeaves(
  input: RecheckEntityConflictLeavesInput,
): Promise<RecheckEntityConflictLeavesResult> {
  const scope = input.resourceType === "PRODUCT"
    ? { kind: "product" as const, productId: input.resourceId }
    : { kind: "collection" as const, collectionId: input.resourceId };

  const { result, warning } = await runSyncWaterfall({
    scope,
    requestedBy: input.requestedBy,
    skipRefresh: false,
  });

  const leaves = result.leaves.filter(
    (leaf) => leaf.resourceType === input.resourceType && leaf.resourceId === input.resourceId,
  );
  return { leaves, warning };
}

/** Find a conflict leaf by fieldKey (preferred) or commerce/translation label. */
export function findConflictLeaf(
  leaves: readonly SyncLeaf[],
  match: { fieldKey?: string | null; label?: string | null },
): SyncLeaf | undefined {
  const fieldKey = match.fieldKey?.trim();
  if (fieldKey) {
    const byKey = leaves.find((leaf) => leaf.fieldKey === fieldKey);
    if (byKey) return byKey;
  }
  const label = match.label?.trim();
  if (label) {
    return leaves.find((leaf) => leaf.label === label);
  }
  return undefined;
}

export function leafMatchesExpectedFingerprints(
  leaf: SyncLeaf,
  expected: { localFingerprint: string; shopifyFingerprint: string },
): boolean {
  return leaf.localFingerprint === expected.localFingerprint
    && leaf.shopifyFingerprint === expected.shopifyFingerprint;
}
