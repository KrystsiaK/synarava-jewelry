import "server-only";

import {
  applyCollectionConflictResolution,
  previewCollectionConflictResolution,
  type CollectionConflictApplyEntryInput,
  type CollectionConflictApplyScope,
} from "@/lib/shopify/collection-conflict-apply";

/** Human-only collection Apply. */
export async function applyCollectionSync(input: {
  entries: CollectionConflictApplyEntryInput[];
  acknowledgeClears: boolean;
  actorUsername: string;
}) {
  return applyCollectionConflictResolution(input);
}

export async function previewCollectionSync(scope: CollectionConflictApplyScope) {
  return previewCollectionConflictResolution(scope);
}
