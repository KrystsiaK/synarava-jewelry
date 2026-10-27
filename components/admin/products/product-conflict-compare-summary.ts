import { productConflictBadgeCount } from "@/lib/sync/badge-count";
import type { CatalogConflictProductSignal } from "@/lib/shopify/catalog-conflict-signals";

export type ProductConflictCompareSummary = {
  /** Same integer the conflict icon badge uses. */
  count: number;
  /** Human locale / scope labels for the banner parenthetical. */
  localeLabels: string[];
};

/**
 * One compare surface for product editor conflict chrome.
 * Banner never lists languages for shared-only conflicts — only locales that
 * actually have translation leaves (plus Presence when present).
 */
export function productConflictCompareSummary(
  signal: CatalogConflictProductSignal | null | undefined,
): ProductConflictCompareSummary {
  const count = productConflictBadgeCount(signal);
  if (count <= 0) return { count: 0, localeLabels: [] };

  const labels: string[] = [];
  const seen = new Set<string>();

  const pushLabel = (label: string) => {
    const trimmed = label.trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    labels.push(trimmed);
  };

  if (signal?.presence) pushLabel("Presence");

  // Shared commerce belongs on base — do not list EN/PT/RU for shared-only.
  if ((signal?.sharedCount ?? 0) > 0) pushLabel("Shared");

  for (const locale of signal?.locales ?? []) {
    if (locale.count > 0) pushLabel(locale.name);
  }

  return { count, localeLabels: labels };
}
