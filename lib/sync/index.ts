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
export {
  SYNC_BASE_NODE,
  SYNC_DEFAULT_LOCALE,
  conflictAddress,
  leafTreeNode,
  selectSyncCounts,
  selectSyncLocaleCodes,
  slice,
  treeNodeForLocale,
  type SyncConflictAddress,
  type SyncSliceFilter,
  type SyncTreeNode,
} from "./select";
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
  findConflictLeaf,
  leafMatchesExpectedFingerprints,
  recheckEntityConflictLeaves,
  type RecheckEntityConflictLeavesInput,
  type RecheckEntityConflictLeavesResult,
} from "./recheck-entity-leaves";
export {
  selectAdminNavSyncCounts,
  type AdminNavSyncEntityType,
} from "./nav-counts";
