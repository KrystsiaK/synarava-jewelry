/**
 * Adapter: SyncResult → legacy CatalogConflictSignals shape for list/editor
 * chrome that still consumes signals. Counts always come from selectSyncCounts.
 */

import type {
  CatalogConflictLocaleSignal,
  CatalogConflictProductSignal,
  CatalogConflictSignals,
} from "@/lib/shopify/catalog-conflict-signals";

import { countConflictedItems, selectSyncCounts } from "./select";
import type { SyncLeaf, SyncResourceType, SyncResult } from "./types";

function localeSignal(
  code: string,
  count: number,
  locales: SyncResult extends never ? never : ReadonlyArray<{ code: string; name: string; nativeName: string }>,
): CatalogConflictLocaleSignal {
  const match = locales.find((locale) => locale.code === code);
  return {
    code,
    name: match?.name ?? code,
    nativeName: match?.nativeName ?? code,
    count,
  };
}

/**
 * Build CatalogConflictSignals from SyncResult for one root entity type.
 * totalCount = countConflictedItems (same definition as nav section counts).
 * Per-item leafCount still comes from selectSyncCounts(listChip).
 */
export function catalogConflictSignalsFromSyncResult(
  result: SyncResult,
  rootEntityType: SyncResourceType,
  localeMeta: ReadonlyArray<{ code: string; name: string; nativeName: string }> = [],
): CatalogConflictSignals {
  const products: Record<string, CatalogConflictProductSignal> = {};
  const byResource = new Map<string, SyncLeaf[]>();

  for (const leaf of result.leaves) {
    if (leaf.resourceType !== rootEntityType) continue;
    const list = byResource.get(leaf.resourceId) ?? [];
    list.push(leaf);
    byResource.set(leaf.resourceId, list);
  }

  for (const [resourceId, leaves] of byResource) {
    const localeCounts = new Map<string, number>();
    let sharedCount = 0;
    let presence: CatalogConflictProductSignal["presence"];
    for (const leaf of leaves) {
      if (leaf.kind === "presence") {
        presence = leaf.label.includes("only in Shopify") || leaf.label.includes("not linked")
          ? "SHOPIFY_ONLY"
          : "SYNARAVA_ONLY";
        continue;
      }
      if (leaf.locale == null) {
        sharedCount += 1;
        continue;
      }
      localeCounts.set(leaf.locale, (localeCounts.get(leaf.locale) ?? 0) + 1);
    }
    const locales: CatalogConflictLocaleSignal[] = [...localeCounts.entries()]
      .map(([code, count]) => localeSignal(code, count, localeMeta))
      .sort((a, b) => a.code.localeCompare(b.code));

    const leafCount = selectSyncCounts(result, {
      kind: "listChip",
      resourceType: rootEntityType,
      resourceId,
    });
    products[resourceId] = {
      shared: sharedCount > 0 || Boolean(presence),
      sharedCount,
      leafCount,
      locales,
      presence,
      allowedDirections: presence === "SHOPIFY_ONLY"
        ? ["SHOPIFY_TO_SYNARAVA"]
        : presence
          ? rootEntityType === "COLLECTION"
            ? ["SHOPIFY_TO_SYNARAVA", "SYNARAVA_TO_SHOPIFY"]
            : ["SYNARAVA_TO_SHOPIFY"]
          : undefined,
    };
  }

  const totalCount = countConflictedItems(result, rootEntityType);

  return {
    state: result.state,
    totalCount,
    checkedAt: result.checkedAt,
    products,
    recentlyUpdatedProducts: { ...result.recentlyUpdatedProducts },
  };
}

/** Per-resource leaf count — same number list chip and editor banner must show. */
export function syncResourceLeafCount(
  result: SyncResult,
  resourceType: SyncResourceType,
  resourceId: string,
): number {
  return selectSyncCounts(result, {
    kind: "listChip",
    resourceType,
    resourceId,
  });
}
