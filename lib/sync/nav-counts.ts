/**
 * Nav section tallies — always via selectSyncCounts over a SyncResult.
 */

import { selectSyncCounts } from "./select";
import {
  type SyncNavCounts,
  type SyncResourceType,
  type SyncResult,
} from "./types";

export type AdminNavSyncEntityType = SyncResourceType;

/** Prefer this when you already have a SyncResult from the waterfall. */
export function selectAdminNavSyncCounts(result: SyncResult): SyncNavCounts {
  return selectSyncCounts(result, { kind: "nav" });
}
