/**
 * ONE selector over SyncResult — every counter (nav, list chip, editor banner,
 * locale tab, section chip) must call this. No parallel counting paths.
 *
 * Section / banner totals = DISTINCT items with ≥1 open conflict leaf.
 * Per-item chips still count leaves on that resource.
 */

import {
  type SyncCountView,
  type SyncLeaf,
  type SyncNavCounts,
  type SyncResourceType,
  type SyncResult,
} from "./types";

function normalizeLocale(locale: string): string {
  return locale.trim().toLowerCase();
}

/** Shared commerce/presence leaves belong under every locale shell. */
function leafMatchesLocale(leaf: SyncLeaf, locale: string): boolean {
  if (leaf.locale == null) return true;
  return normalizeLocale(leaf.locale) === normalizeLocale(locale);
}

function leavesForResource(
  result: SyncResult,
  resourceType: SyncResourceType,
  resourceId: string,
): SyncLeaf[] {
  return result.leaves.filter(
    (leaf) => leaf.resourceType === resourceType && leaf.resourceId === resourceId,
  );
}

/**
 * Number of DISTINCT items (products / collections / pages / settings) that
 * have at least one open conflict leaf (commerce, translation, or presence).
 * Menu badge, list banner, header chip, and top-bar section counts use this.
 */
export function countConflictedItems(
  result: SyncResult,
  resourceType?: SyncResourceType,
): number {
  const ids = new Set<string>();
  for (const leaf of result.leaves) {
    if (resourceType != null && leaf.resourceType !== resourceType) continue;
    ids.add(`${leaf.resourceType}:${leaf.resourceId}`);
  }
  return ids.size;
}

function countNav(result: SyncResult): SyncNavCounts {
  return {
    products: countConflictedItems(result, "PRODUCT"),
    collections: countConflictedItems(result, "COLLECTION"),
    pages: countConflictedItems(result, "PAGE"),
    settings: countConflictedItems(result, "STOREFRONT_COPY"),
    total: countConflictedItems(result),
  };
}

/**
 * Derive a counter from the single SyncResult.
 * listChip / editorBanner / (full) resource views share the same leaf set so
 * they always agree for a given resource id.
 */
export function selectSyncCounts(result: SyncResult, view: { kind: "nav" }): SyncNavCounts;
export function selectSyncCounts(
  result: SyncResult,
  view: Exclude<SyncCountView, { kind: "nav" }>,
): number;
export function selectSyncCounts(
  result: SyncResult,
  view: SyncCountView,
): SyncNavCounts | number {
  if (view.kind === "nav") return countNav(result);

  const resourceLeaves = leavesForResource(result, view.resourceType, view.resourceId);

  if (view.kind === "listChip" || view.kind === "editorBanner") {
    return resourceLeaves.length;
  }

  if (view.kind === "localeTab") {
    return resourceLeaves.filter((leaf) => leafMatchesLocale(leaf, view.locale)).length;
  }

  // sectionChip: without a section mapper, count locale-matching leaves
  // (shared + that locale). Section filtering is a UI concern layered on top.
  return resourceLeaves.filter((leaf) => leafMatchesLocale(leaf, view.locale)).length;
}

/** Locale codes that have at least one leaf (plus shared) for a resource. */
export function selectSyncLocaleCodes(
  result: SyncResult,
  resourceType: SyncResourceType,
  resourceId: string,
): string[] {
  const codes = new Set<string>();
  for (const leaf of leavesForResource(result, resourceType, resourceId)) {
    if (leaf.locale) codes.add(leaf.locale);
  }
  return [...codes].sort();
}
