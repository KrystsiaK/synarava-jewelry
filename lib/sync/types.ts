/**
 * Sync unification (PR5) — single result tree for every admin counter/view.
 * Two states only: Shopify vs Synarava. No third “base” window.
 */

import type { SyncConflictSection, SyncLeafPart } from "./field-registry";

export type SyncResourceType = "PRODUCT" | "COLLECTION" | "PAGE" | "STOREFRONT_COPY";

export type SyncLeafKind = "commerce" | "translation" | "presence";

export type SyncDirection = "SHOPIFY_TO_SYNARAVA" | "SYNARAVA_TO_SHOPIFY";

export type SyncResultState =
  | "ready"
  | "checking"
  | "stale"
  | "failed"
  | "disconnected"
  | "unknown";

export type SyncPresenceSide = "SHOPIFY_ONLY" | "SYNARAVA_ONLY";

export type SyncTargetKind = "NATIVE" | "METAFIELD" | "METAOBJECT";

export type { SyncConflictSection, SyncLeafPart };

/** One diverging field / presence / translation cell. */
export type SyncLeaf = {
  id: string;
  resourceType: SyncResourceType;
  resourceId: string;
  kind: SyncLeafKind;
  /** Registry locale code; null = shared commerce / presence. */
  locale: string | null;
  fieldKey: string;
  label: string;
  synaravaValue: string;
  shopifyValue: string;
  allowedDirections: SyncDirection[];
  blockedReason: string | null;
  sourceId: string | null;
  path: string | null;
  /** Field-contract key (registry) — authoritative for apply/routing. */
  contractKey?: string | null;
  /** Editor section from the field contract (or any part for whole-item). */
  section?: SyncConflictSection | null;
  /**
   * Whole-item leaf only: structured constituent diffs. Display text and
   * translation-dedupe read `parts` — never parse `Label: value` lines.
   */
  parts?: readonly SyncLeafPart[] | null;
  /**
   * Leaf address node: shared commerce/presence → `"base"`;
   * translation → locale code. Never put shared commerce under a locale tab.
   */
  node?: "base" | string;
  /** Presence display — title/handle/sku for ConflictResolver entity summary. */
  displayName?: string | null;
  displayHandle?: string | null;
  displaySku?: string | null;
  /** Presence only — which catalog side is missing the entity. */
  presenceSide?: SyncPresenceSide | null;
  /** Translation target surface; commerce usually NATIVE (or METAFIELD for passport). */
  targetKind?: SyncTargetKind | null;
  localFingerprint?: string | null;
  shopifyFingerprint?: string | null;
};

/** Single compare result — SoT for nav badge, list chip, banner, locale tab, section chip. */
export type SyncResult = {
  checkedAt: string | null;
  state: SyncResultState;
  leaves: readonly SyncLeaf[];
  /**
   * Linked entities whose Shopify window was never fetched (shopifySnapshot null).
   * Counted separately from conflicts — never treated as "all good".
   */
  uncheckedCount: number;
  recentlyUpdatedProducts: Readonly<Record<string, { updatedAt: string }>>;
};

export type SyncNavCounts = {
  products: number;
  collections: number;
  pages: number;
  settings: number;
  total: number;
};

export type SyncCountView =
  | { kind: "nav" }
  | { kind: "listChip"; resourceType: SyncResourceType; resourceId: string }
  | { kind: "editorBanner"; resourceType: SyncResourceType; resourceId: string }
  | { kind: "localeTab"; resourceType: SyncResourceType; resourceId: string; locale: string }
  | {
      kind: "sectionChip";
      resourceType: SyncResourceType;
      resourceId: string;
      locale: string;
      /** Product/collection editor section id — shared leaves always match. */
      section?: string;
    };

export const EMPTY_SYNC_NAV_COUNTS: SyncNavCounts = {
  products: 0,
  collections: 0,
  pages: 0,
  settings: 0,
  total: 0,
};

export function emptySyncResult(overrides?: Partial<SyncResult>): SyncResult {
  return {
    checkedAt: null,
    state: "disconnected",
    leaves: [],
    uncheckedCount: 0,
    recentlyUpdatedProducts: {},
    ...overrides,
  };
}
