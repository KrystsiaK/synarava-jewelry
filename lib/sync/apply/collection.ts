import "server-only";

import {
  applyCollectionConflictResolution,
  previewCollectionConflictResolution,
  type CollectionConflictApplyScope,
} from "@/lib/shopify/collection-conflict-apply";

/** Human-only collection Apply. */
export async function applyCollectionSync(input: {
  scope: CollectionConflictApplyScope;
  confirmedClearNonEmpty: boolean;
}) {
  return applyCollectionConflictResolution(input);
}

export async function previewCollectionSync(scope: CollectionConflictApplyScope) {
  return previewCollectionConflictResolution(scope);
}
