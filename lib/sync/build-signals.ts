/**
 * Legacy CatalogConflictSignals builder — lives under lib/sync so there is no
 * second counter module. Production admin load / Check / post-Save use
 * runSyncWaterfall → compareSyncState → catalogConflictSignalsFromSyncResult.
 * This helper remains for characterization tests and transitional call sites.
 */

import type { StorefrontLocaleRecord } from "@/lib/i18n/storefront-locale-registry";
import type { CatalogPresenceDifference } from "@/lib/shopify/catalog-presence";
import type {
  CatalogConflictLocaleSignal,
  CatalogConflictProductSignal,
  CatalogConflictSignalState,
  CatalogConflictSignals,
} from "@/lib/shopify/catalog-conflict-signals";
import type { ReconcileDifferenceView, ReconcileRunSummary } from "@/lib/shopify/reconciliation-run";

import { productConflictBadgeCount } from "./badge-count";

type Locale = Pick<
  StorefrontLocaleRecord,
  "code" | "shopifyLocale" | "name" | "nativeName" | "isDefault" | "sortOrder"
>;
type Difference = Pick<
  ReconcileDifferenceView,
  "rootEntityType" | "rootEntityId" | "locale" | "fieldKey" | "kind"
>;
type Run = Pick<ReconcileRunSummary, "trigger" | "status" | "completedAt">;

const STALE_AFTER_MS = 30 * 60 * 1000;

/** A persisted, catalog-wide signal. This never claims a live Shopify comparison. */
export function buildCatalogConflictSignals({
  commerceProductIds,
  commerceFieldCounts = {},
  differences,
  presenceDifferences = [],
  locales,
  run,
  lastSuccessfulFullCheckAt,
  connected,
  recentlyUpdatedProducts = [],
  now,
  rootEntityType = "PRODUCT",
}: {
  commerceProductIds: string[];
  commerceFieldCounts?: Record<string, number>;
  differences: Difference[];
  presenceDifferences?: CatalogPresenceDifference[];
  locales: Locale[];
  run: Run | null;
  lastSuccessfulFullCheckAt?: string | null;
  connected: boolean;
  recentlyUpdatedProducts?: Array<{ productId: string; updatedAt: string }>;
  now: Date;
  rootEntityType?: "PRODUCT" | "COLLECTION";
}): CatalogConflictSignals {
  const localeByShopifyCode = new Map(
    locales.map((locale) => [locale.isDefault ? locale.code : locale.shopifyLocale, locale]),
  );
  const localeOrder = new Map(
    locales.map((locale, index) => [locale.code, { order: locale.sortOrder, index }]),
  );
  const products: Record<string, CatalogConflictProductSignal> = {};
  const seenFields = new Set<string>();

  for (const difference of presenceDifferences) {
    products[difference.id] = {
      shared: true,
      sharedCount: 0,
      locales: [],
      presence: difference.kind,
      localProductId: difference.localProductId,
      shopifyProductId: difference.shopifyProductId,
      name: difference.name,
      handle: difference.handle,
      sku: difference.sku,
      remoteMissing: difference.remoteMissing,
      matchReason: difference.matchReason,
      allowedDirections: difference.kind === "SHOPIFY_ONLY"
        ? ["SHOPIFY_TO_SYNARAVA"]
        : rootEntityType === "COLLECTION"
          ? ["SHOPIFY_TO_SYNARAVA", "SYNARAVA_TO_SHOPIFY"]
          : ["SYNARAVA_TO_SHOPIFY"],
    };
  }
  // Products and collections both carry shared commerce divergences (PR4 + PR5a).
  if (rootEntityType === "PRODUCT" || rootEntityType === "COLLECTION") {
    for (const productId of commerceProductIds) {
      const fieldCount = Math.max(0, Math.trunc(commerceFieldCounts[productId] ?? 0));
      products[productId] = products[productId] ?? { shared: true, locales: [], sharedCount: 0 };
      products[productId].shared = true;
      products[productId].sharedCount = fieldCount > 0
        ? fieldCount
        : Math.max(products[productId].sharedCount ?? 0, 1);
    }
  }
  for (const difference of differences) {
    if (difference.rootEntityType !== rootEntityType) continue;
    if (rootEntityType === "PRODUCT" && difference.kind !== "CONFLICT") continue;
    const product = products[difference.rootEntityId] ?? { shared: false, locales: [] };
    products[difference.rootEntityId] = product;
    const registered = localeByShopifyCode.get(difference.locale);
    const code = registered?.code ?? difference.locale;
    const identity = JSON.stringify([difference.rootEntityId, code, difference.fieldKey]);
    if (seenFields.has(identity)) continue;
    seenFields.add(identity);
    let locale: CatalogConflictLocaleSignal | undefined = product.locales.find(
      (entry) => entry.code === code,
    );
    if (!locale) {
      locale = {
        code,
        name: registered?.name ?? code,
        nativeName: registered?.nativeName ?? code,
        count: 0,
      };
      product.locales.push(locale);
    }
    locale.count += 1;
  }

  for (const product of Object.values(products)) {
    product.locales.sort((a, b) => {
      const first = localeOrder.get(a.code);
      const second = localeOrder.get(b.code);
      return (first?.order ?? Infinity) - (second?.order ?? Infinity)
        || (first?.index ?? Infinity) - (second?.index ?? Infinity)
        || a.code.localeCompare(b.code);
    });
    product.leafCount = productConflictBadgeCount(product);
  }

  const checkedAt = lastSuccessfulFullCheckAt
    ?? (run?.status === "SUCCEEDED" && (run.trigger === "AUTO" || run.trigger === "MANUAL")
      ? run.completedAt
      : null);
  let state: CatalogConflictSignalState;
  if (!connected) state = "disconnected";
  else if (run?.status === "QUEUED" || run?.status === "RUNNING") state = "checking";
  else if (run?.status === "FAILED" || run?.status === "PARTIAL") state = "failed";
  else if (!checkedAt || now.getTime() - new Date(checkedAt).getTime() > STALE_AFTER_MS) state = "stale";
  else state = "ready";

  return {
    state,
    totalCount: Object.keys(products).length,
    checkedAt,
    products,
    recentlyUpdatedProducts: Object.fromEntries(
      recentlyUpdatedProducts.map((item) => [item.productId, { updatedAt: item.updatedAt }]),
    ),
  };
}
