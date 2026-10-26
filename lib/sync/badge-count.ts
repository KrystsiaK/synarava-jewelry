/**
 * Read the authoritative leaf count from a catalog signal.
 * leafCount is set by catalogConflictSignalsFromSyncResult via selectSyncCounts —
 * this is not a second counting path. No legacy shared=+1 fallback.
 */

export function productConflictBadgeCount(
  signal: {
    leafCount?: number;
  } | null | undefined,
): number {
  if (signal?.leafCount == null) return 0;
  return Math.max(0, Math.trunc(signal.leafCount));
}
