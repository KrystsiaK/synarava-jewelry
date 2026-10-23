import type { CatalogPresenceDifference } from "@/lib/shopify/catalog-presence";

export type CatalogConflictSignalState = "ready" | "checking" | "stale" | "failed" | "disconnected";

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
  totalCount: number | null;
  checkedAt: string | null;
  products: Record<string, CatalogConflictProductSignal>;
  recentlyUpdatedProducts: Record<string, { updatedAt: string }>;
};
