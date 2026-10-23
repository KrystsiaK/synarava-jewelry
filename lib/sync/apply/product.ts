import "server-only";

import {
  applyCatalogConflictResolution,
  previewCatalogConflictResolution,
  type CatalogConflictApplyScope,
} from "@/lib/shopify/catalog-conflict-apply";

/** Human-only product Apply — dispatches to existing catalog conflict apply. */
export async function applyProductSync(input: {
  scope: CatalogConflictApplyScope;
  confirmedClearNonEmpty: boolean;
}) {
  return applyCatalogConflictResolution(input);
}

export async function previewProductSync(scope: CatalogConflictApplyScope) {
  return previewCatalogConflictResolution(scope);
}
