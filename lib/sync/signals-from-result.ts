/**
 * Adapter: SyncResult → legacy CatalogConflictSignals shape for list/editor
 * chrome that still consumes signals. Counts always come from selectSyncCounts.
 */

import type {
  CatalogConflictLocaleSignal,
  CatalogConflictProductSignal,
  CatalogConflictSignals,
} from "@/lib/shopify/catalog-conflict-signals";

import type { SyncConflictSection } from "./field-registry";
import { selectSyncCounts, slice } from "./select";
import type { SyncLeaf, SyncResourceType, SyncResult } from "./types";

function sectionsFromLeaves(leaves: readonly SyncLeaf[]): SyncConflictSection[] {
  const sections = new Set<SyncConflictSection>();
  for (const leaf of leaves) {
    if (leaf.kind === "presence") {
      sections.add("shopify");
      continue;
    }
    if (leaf.parts && leaf.parts.length > 0) {
      for (const part of leaf.parts) sections.add(part.section);
      continue;
    }
    if (leaf.section) sections.add(leaf.section);
  }
  return [...sections].toSorted();
}

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
 * totalCount = leaf conflicts for the type (same as nav section via selectSyncCounts).
 * Per-entity leafCount comes from selectSyncCounts(listChip).
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
    let displayName: string | undefined;
    let displayHandle: string | undefined;
    let displaySku: string | undefined;
    for (const leaf of leaves) {
      if (leaf.kind === "presence") {
        presence = leaf.presenceSide === "SHOPIFY_ONLY"
          ? "SHOPIFY_ONLY"
          : leaf.presenceSide === "SYNARAVA_ONLY"
            ? "SYNARAVA_ONLY"
            : undefined;
        if (leaf.displayName) displayName = leaf.displayName;
        if (leaf.displayHandle) displayHandle = leaf.displayHandle;
        if (leaf.displaySku) displaySku = leaf.displaySku;
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
      sections: sectionsFromLeaves(leaves),
      locales,
      presence,
      name: displayName,
      handle: displayHandle,
      sku: displaySku,
      allowedDirections: presence
        ? leaves.find((leaf) => leaf.kind === "presence")?.allowedDirections
        : undefined,
    };
  }

  const totalCount = slice(result, { entityType: rootEntityType }).length;

  return {
    state: result.state,
    totalCount,
    checkedAt: result.checkedAt,
    uncheckedCount: result.uncheckedCount,
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
