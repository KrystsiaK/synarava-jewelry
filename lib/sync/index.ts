/**
 * lib/sync — one module for refresh / compare / select (sync-unification).
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
export {
  catalogConflictFieldsForEntity,
  catalogConflictFieldsFromLeaves,
  type ConflictFieldLocaleMeta,
} from "./conflict-fields-from-leaves";
export { productConflictBadgeCount } from "./badge-count";
export {
  selectAdminNavSyncCounts,
  type AdminNavSyncEntityType,
} from "./nav-counts";
