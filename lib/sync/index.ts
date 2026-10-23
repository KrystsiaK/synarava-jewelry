/**
 * lib/sync — one module for refresh / compare / select / apply (sync-unification PR5).
 */

export {
  compareSyncState,
  type SyncCommerceWindow,
  type SyncCompareInput,
  type SyncLocaleRef,
} from "./compare";
export { selectSyncCounts, selectSyncLocaleCodes } from "./select";
export {
  emptySyncResult,
  EMPTY_SYNC_NAV_COUNTS,
  type SyncCountView,
  type SyncDirection,
  type SyncLeaf,
  type SyncLeafKind,
  type SyncNavCounts,
  type SyncResourceType,
  type SyncResult,
  type SyncResultState,
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
  applySync,
  applyCollectionSync,
  applyPresenceSync,
  applyProductSync,
  applyTranslationSync,
  previewCollectionSync,
  previewProductSync,
  type SyncApplyTarget,
} from "./apply";
