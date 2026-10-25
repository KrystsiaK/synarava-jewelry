/**
 * Shared Vitest mocks for `@/app/admin/actions/sync`.
 * Keep the export list aligned with `app/admin/actions/sync.ts`.
 *
 *   vi.mock("@/app/admin/actions/sync", async () => {
 *     const { adminSyncActionMocks } = await import("@/test/mocks/admin-sync-actions");
 *     return { ...adminSyncActionMocks };
 *   });
 *   import { adminSyncActionMocks } from "@/test/mocks/admin-sync-actions";
 */

import { vi } from "vitest";

/** Public action names exported from app/admin/actions/sync.ts */
export const ADMIN_SYNC_ACTION_EXPORTS = [
  "inspectProductSyncAction",
  "loadCatalogConflictSignalsAction",
  "loadProductCatalogConflictAction",
  "listCustomProductMetafieldDefinitionsAction",
  "createProductMetafieldDefinitionAction",
  "loadCollectionConflictSignalsAction",
  "loadCollectionCatalogConflictAction",
  "previewCollectionConflictResolutionAction",
  "applyCollectionConflictResolutionAction",
  "previewCatalogConflictResolutionAction",
  "applyCatalogConflictResolutionAction",
  "markProductIncomingUpdateViewedAction",
  "pushSingleProductToShopifyAction",
  "pullSingleProductFromShopifyAction",
] as const;

export type AdminSyncActionName = (typeof ADMIN_SYNC_ACTION_EXPORTS)[number];
export type AdminSyncActionMocks = Record<AdminSyncActionName, ReturnType<typeof vi.fn>>;

function buildAdminSyncActionMocks(): AdminSyncActionMocks {
  return Object.fromEntries(
    ADMIN_SYNC_ACTION_EXPORTS.map((name) => [name, vi.fn()]),
  ) as AdminSyncActionMocks;
}

/** Stable mock fns for the current Vitest worker — reset in beforeEach via vi.clearAllMocks(). */
export const adminSyncActionMocks: AdminSyncActionMocks = buildAdminSyncActionMocks();

/** Fresh map (for rare cases that must not share the worker singleton). */
export function createAdminSyncActionMocks(
  overrides: Partial<AdminSyncActionMocks> = {},
): AdminSyncActionMocks {
  return { ...buildAdminSyncActionMocks(), ...overrides };
}
