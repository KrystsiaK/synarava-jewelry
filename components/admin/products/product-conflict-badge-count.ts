/**
 * Badge / tooltip count for a product or product+locale conflict view.
 * Shared commerce fields use `sharedCount` (field diffs), not a boolean +1.
 */
export function productConflictBadgeCount(
  signal: {
    shared?: boolean;
    sharedCount?: number;
    presence?: string;
    locales: ReadonlyArray<{ count: number }>;
  } | null | undefined,
  options?: { commerceFieldCount?: number },
): number {
  if (!signal && !(options?.commerceFieldCount && options.commerceFieldCount > 0)) return 0;

  const localeCount = signal?.locales.reduce((sum, entry) => sum + entry.count, 0) ?? 0;
  const commerce = options?.commerceFieldCount != null && options.commerceFieldCount > 0
    ? options.commerceFieldCount
    : Math.max(0, signal?.sharedCount ?? 0);
  // Legacy rows: shared=true without a field count (and not presence-only).
  const legacyShared = commerce === 0 && signal?.shared && !signal.presence ? 1 : 0;
  const presence = signal?.presence ? 1 : 0;
  return localeCount + commerce + legacyShared + presence;
}
