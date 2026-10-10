import { productConflictBadgeCount } from "@/components/admin/products/product-conflict-badge-count";
import type { CatalogConflictProductSignal } from "@/lib/shopify/catalog-conflict-signals";

export type ProductConflictCompareSummary = {
  /** Same integer the conflict icon badge uses. */
  count: number;
  /** Human locale / scope labels for the banner parenthetical. */
  localeLabels: string[];
};

/**
 * One compare surface for product editor conflict chrome.
 * Banner, icon badge, and Sync commerce count must derive from this —
 * never from a parallel unfiltered translation-reconcile dump.
 */
export function productConflictCompareSummary(
  signal: CatalogConflictProductSignal | null | undefined,
  options?: {
    commerceFieldCount?: number;
    /** Language shells (EN + published overlays) when shared commerce differs. */
    localeTabs?: ReadonlyArray<{ code: string; label: string }>;
  },
): ProductConflictCompareSummary {
  const count = productConflictBadgeCount(signal, {
    commerceFieldCount: options?.commerceFieldCount,
  });
  if (count <= 0) return { count: 0, localeLabels: [] };

  const commerce = options?.commerceFieldCount != null && options.commerceFieldCount > 0
    ? options.commerceFieldCount
    : Math.max(0, signal?.sharedCount ?? 0);
  const legacyShared = commerce === 0 && signal?.shared && !signal.presence;
  const labels: string[] = [];
  const seen = new Set<string>();

  const pushLabel = (label: string) => {
    const trimmed = label.trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    labels.push(trimmed);
  };

  if (signal?.presence) pushLabel("Presence");

  if (commerce > 0 || legacyShared) {
    for (const tab of options?.localeTabs ?? []) pushLabel(tab.label);
    if ((options?.localeTabs?.length ?? 0) === 0) pushLabel("Shared commerce");
  }

  for (const locale of signal?.locales ?? []) {
    if (locale.count > 0) pushLabel(locale.name);
  }

  return { count, localeLabels: labels };
}
