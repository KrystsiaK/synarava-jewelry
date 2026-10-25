/**
 * lib/sync — one module for refresh / compare / select / apply (sync-unification PR5).
 */

export {
  allowedDirectionsForLeaf,
  compareSyncState,
  type SyncCommerceWindow,
  type SyncCompareInput,
  type SyncLocaleRef,
} from "./compare";
export { countConflictedItems, selectSyncCounts, selectSyncLocaleCodes } from "./select";
export {
  emptySyncResult,
  EMPTY_SYNC_NAV_COUNTS,
  type SyncCountView,
  type SyncDirection,
  type SyncLeaf,
  type SyncLeafKind,
  type SyncNavCounts,
  type SyncPresenceSide,
  type SyncResourceType,
  type SyncResult,
  type SyncResultState,
  type SyncTargetKind,
} from "./types";
export {
  refreshShopifyState,
  type RefreshShopifyStateResult,
  type RefreshShopifyStateScope,
} from "./refresh-shopify-state";
export { readSynaravaStateForCompare } from "./read-synarava-state";
export { runSyncWaterfall, type SyncWaterfallResult } from "./waterfall";
export {
  catalogConflictSignalsFromSyncResult,
  syncResourceLeafCount,
} from "./signals-from-result";
export { buildCatalogConflictSignals } from "./build-signals";
export { productConflictBadgeCount } from "./badge-count";
export {
  countAdminNavSyncBySection,
  selectAdminNavSyncCounts,
  type AdminNavSyncEntityType,
} from "./nav-counts";
export {
  applySync,
  applyCollectionSync,
  applyPresenceSync,
  applyProductSync,
  applyTranslationSync,
  previewCollectionSync,
  previewProductSync,
  type SyncApplyTarget,
} from "./apply";
