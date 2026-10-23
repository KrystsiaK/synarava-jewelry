/**
 * Nav section tallies — always via selectSyncCounts over a SyncResult.
 */

import { selectSyncCounts } from "./select";
import {
  EMPTY_SYNC_NAV_COUNTS,
  emptySyncResult,
  type SyncNavCounts,
  type SyncResourceType,
  type SyncResult,
} from "./types";

export type AdminNavSyncEntityType = SyncResourceType;

/** Prefer this when you already have a SyncResult from the waterfall. */
export function selectAdminNavSyncCounts(result: SyncResult): SyncNavCounts {
  return selectSyncCounts(result, { kind: "nav" });
}

/**
 * Build a SyncResult-shaped leaf list from reconcile difference rows only
 * (layout bootstrap before a full waterfall). Still counted by selectSyncCounts.
 */
export function countAdminNavSyncBySection(
  differences: ReadonlyArray<{ rootEntityType: AdminNavSyncEntityType; rootEntityId?: string; id?: string }>,
): SyncNavCounts {
  if (differences.length === 0) return { ...EMPTY_SYNC_NAV_COUNTS };
  const result = emptySyncResult({
    state: "ready",
    leaves: differences.map((difference, index) => ({
      id: difference.id ?? `nav:${difference.rootEntityType}:${difference.rootEntityId ?? index}`,
      resourceType: difference.rootEntityType,
      resourceId: difference.rootEntityId ?? String(index),
      kind: "translation" as const,
      locale: null,
      fieldKey: `nav:${index}`,
      label: "Sync",
      synaravaValue: "",
      shopifyValue: "",
      allowedDirections: [],
      blockedReason: null,
      sourceId: null,
      path: null,
    })),
  });
  return selectSyncCounts(result, { kind: "nav" });
}
