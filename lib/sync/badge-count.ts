/**
 * Read the authoritative leaf count from a catalog signal.
 * leafCount is set by catalogConflictSignalsFromSyncResult via selectSyncCounts —
 * this is not a second counting path.
 */

export function productConflictBadgeCount(
  signal: {
    leafCount?: number;
    shared?: boolean;
    sharedCount?: number;
    presence?: string;
    locales: ReadonlyArray<{ count: number }>;
  } | null | undefined,
  options?: { commerceFieldCount?: number },
): number {
  if (signal?.leafCount != null) return Math.max(0, Math.trunc(signal.leafCount));

  // Test / partial fixtures without SyncResult leafCount — last-resort sum of
  // fields that were themselves derived from compare leaves when present.
  if (!signal && !(options?.commerceFieldCount && options.commerceFieldCount > 0)) return 0;
  const localeCount = signal?.locales.reduce((sum, entry) => sum + entry.count, 0) ?? 0;
  const commerce = options?.commerceFieldCount != null && options.commerceFieldCount > 0
    ? options.commerceFieldCount
    : Math.max(0, signal?.sharedCount ?? 0);
  const legacyShared = commerce === 0 && signal?.shared && !signal.presence ? 1 : 0;
  const presence = signal?.presence ? 1 : 0;
  return localeCount + commerce + legacyShared + presence;
}
