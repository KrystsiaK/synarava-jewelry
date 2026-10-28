import type { CatalogPresenceDifference } from "@/lib/shopify/catalog-presence";

export type CatalogConflictSignalState =
  | "ready"
  | "checking"
  | "stale"
  | "failed"
  | "disconnected"
  | "unknown";

export type CatalogConflictLocaleSignal = {
  code: string;
  name: string;
  nativeName: string;
  count: number;
};

export type CatalogConflictProductSignal = {
  shared: boolean;
  /**
   * How many shared commerce fields differ (price, vendor, title, …).
   * When set, badge counts use this instead of treating `shared` as a single unit.
   */
  sharedCount?: number;
  /**
   * Authoritative conflict leaf count from `selectSyncCounts` (sync-unification PR5).
   * Nav badge, list chip, editor banner, and locale tab must use this — never a
   * parallel reduce over locales/shared.
   */
  leafCount?: number;
  /**
   * Difference count for banner copy: sum of whole-item `parts`, else 1 per leaf.
   * Banner: "1 conflict (N differences)" when this exceeds leafCount.
   */
  differenceCount?: number;
  /**
   * Editor sections that own at least one leaf/part (presence → `"shopify"`).
   * Tab dots read this — never invent presence-only or light every shared tab.
   */
  sections?: readonly import("@/lib/sync/field-registry").SyncConflictSection[];
  locales: CatalogConflictLocaleSignal[];
  presence?: CatalogPresenceDifference["kind"] | "BOTH";
  localProductId?: string | null;
  shopifyProductId?: string | null;
  name?: string;
  handle?: string;
  sku?: string;
  remoteMissing?: boolean;
  matchReason?: CatalogPresenceDifference["matchReason"];
  allowedDirections?: Array<"SHOPIFY_TO_SYNARAVA" | "SYNARAVA_TO_SHOPIFY">;
};

export type CatalogConflictSignals = {
  state: CatalogConflictSignalState;
  /** Open conflict leaf count for this section (same as nav badge). */
  totalCount: number | null;
  checkedAt: string | null;
  /** Linked rows with no Shopify window yet — shown as "N not checked", not conflicts. */
  uncheckedCount?: number;
  products: Record<string, CatalogConflictProductSignal>;
  recentlyUpdatedProducts: Record<string, { updatedAt: string }>;
};
