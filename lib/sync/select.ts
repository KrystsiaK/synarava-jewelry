/**
 * ONE selector over SyncResult — every counter (nav, list chip, editor banner,
 * locale tab, section chip) must call this. No parallel counting paths.
 *
 * Display tree: entity = branch; node `base` (EN tab) holds shared + base text;
 * sibling locale nodes (pt, ru, …) hold ONLY that locale's translation leaves.
 * Shared conflicts never light a locale tab.
 */

import {
  type SyncCountView,
  type SyncLeaf,
  type SyncNavCounts,
  type SyncResourceType,
  type SyncResult,
} from "./types";

/** Tree node under an entity branch — `base` is the EN/default shell. */
export type SyncTreeNode = "base" | (string & {});

export type SyncConflictAddress = {
  entityType: SyncResourceType;
  entityId: string;
  node: SyncTreeNode;
  fieldKey: string;
};

export type SyncSliceFilter = {
  entityType?: SyncResourceType;
  entityId?: string;
  /** `base` or a locale code (EN maps to `base`). */
  node?: SyncTreeNode;
};

export const SYNC_BASE_NODE = "base" as const;
/** Default commerce/source locale — EN tab ≡ base node. */
export const SYNC_DEFAULT_LOCALE = "en";

function normalizeLocale(locale: string): string {
  return locale.trim().toLowerCase();
}

/** Map a UI locale tab code to the tree node (`en` → `base`). */
export function treeNodeForLocale(locale: string): SyncTreeNode {
  const code = normalizeLocale(locale);
  if (code === SYNC_BASE_NODE || code === SYNC_DEFAULT_LOCALE) return SYNC_BASE_NODE;
  return code;
}

/** Address derived from an existing leaf — no new storage. */
export function conflictAddress(leaf: SyncLeaf): SyncConflictAddress {
  return {
    entityType: leaf.resourceType,
    entityId: leaf.resourceId,
    node: leafTreeNode(leaf),
    fieldKey: leaf.fieldKey,
  };
}

/** `locale == null` or default EN → base; otherwise the locale code. */
export function leafTreeNode(leaf: SyncLeaf): SyncTreeNode {
  if (leaf.locale == null) return SYNC_BASE_NODE;
  return treeNodeForLocale(leaf.locale);
}

function nodeEquals(a: SyncTreeNode, b: SyncTreeNode): boolean {
  return normalizeLocale(String(a)) === normalizeLocale(String(b));
}

/**
 * Slice SyncResult leaves by entity and/or tree node.
 * - omit node → all leaves of the entity (or store-wide if entity omitted)
 * - node `base` → shared + base-text only
 * - node `pt` → PT translation leaves only (never image/shared)
 */
export function slice(result: SyncResult, filter: SyncSliceFilter = {}): SyncLeaf[] {
  const wantNode = filter.node != null ? treeNodeForLocale(String(filter.node)) : null;
  return result.leaves.filter((leaf) => {
    if (filter.entityType != null && leaf.resourceType !== filter.entityType) return false;
    if (filter.entityId != null && leaf.resourceId !== filter.entityId) return false;
    if (wantNode != null && !nodeEquals(leafTreeNode(leaf), wantNode)) return false;
    return true;
  });
}

function leavesForResource(
  result: SyncResult,
  resourceType: SyncResourceType,
  resourceId: string,
): SyncLeaf[] {
  return slice(result, { entityType: resourceType, entityId: resourceId });
}

/** Leaf tally for one resource type (or the whole result). */
function leafCount(result: SyncResult, resourceType?: SyncResourceType): number {
  if (resourceType == null) return result.leaves.length;
  return slice(result, { entityType: resourceType }).length;
}

/** Nav badges = leaf conflicts per section (not distinct entities). */
function countNav(result: SyncResult): SyncNavCounts {
  return {
    products: leafCount(result, "PRODUCT"),
    collections: leafCount(result, "COLLECTION"),
    pages: leafCount(result, "PAGE"),
    settings: leafCount(result, "STOREFRONT_COPY"),
    total: leafCount(result),
  };
}

/**
 * Derive a counter from the single SyncResult.
 * listChip / editorBanner / (full) resource views share the same leaf set so
 * they always agree for a given resource id.
 * localeTab / sectionChip use the tree node (EN → base; PT → pt only).
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

  if (view.kind === "listChip" || view.kind === "editorBanner") {
    return leavesForResource(result, view.resourceType, view.resourceId).length;
  }

  // localeTab / sectionChip — tree node slice (shared never under PT/RU).
  return slice(result, {
    entityType: view.resourceType,
    entityId: view.resourceId,
    node: treeNodeForLocale(view.locale),
  }).length;
}

/** Locale codes that have at least one leaf (non-base) for a resource. */
export function selectSyncLocaleCodes(
  result: SyncResult,
  resourceType: SyncResourceType,
  resourceId: string,
): string[] {
  const codes = new Set<string>();
  for (const leaf of leavesForResource(result, resourceType, resourceId)) {
    const node = leafTreeNode(leaf);
    if (node !== SYNC_BASE_NODE) codes.add(normalizeLocale(String(node)));
  }
  return [...codes].sort();
}
