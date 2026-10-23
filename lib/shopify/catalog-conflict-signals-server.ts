import "server-only";

import { getStorefrontLocales } from "@/lib/i18n/storefront-locale-cache";
import type { CatalogConflictSignals } from "@/lib/shopify/catalog-conflict-signals";
import {
  catalogConflictSignalsFromSyncResult,
  runSyncWaterfall,
  type RefreshShopifyStateScope,
} from "@/lib/sync";

async function localeMeta() {
  const locales = await getStorefrontLocales();
  return locales.map((locale) => ({
    code: locale.code,
    name: locale.name,
    nativeName: locale.nativeName,
  }));
}

async function signalsFromWaterfall(
  scope: RefreshShopifyStateScope,
  requestedBy: string,
  rootEntityType: "PRODUCT" | "COLLECTION",
  options?: { skipRefresh?: boolean },
): Promise<{ signals: CatalogConflictSignals; warning?: string }> {
  const { result, warning } = await runSyncWaterfall({
    scope,
    requestedBy,
    skipRefresh: options?.skipRefresh,
  });
  const signals = catalogConflictSignalsFromSyncResult(
    result,
    rootEntityType,
    await localeMeta(),
  );
  return { signals, warning };
}

export async function getCatalogConflictSignals(adminUsername?: string): Promise<CatalogConflictSignals> {
  const { signals } = await signalsFromWaterfall(
    { kind: "catalog" },
    adminUsername ?? "system",
    "PRODUCT",
    { skipRefresh: true },
  );
  return signals;
}

/** Same signal shape as products; `products` map holds collection IDs. */
export async function getCollectionConflictSignals(): Promise<CatalogConflictSignals> {
  const { signals } = await signalsFromWaterfall(
    { kind: "collections" },
    "system",
    "COLLECTION",
    { skipRefresh: true },
  );
  return signals;
}

/**
 * Scoped conflict check for one product (optional locale).
 * Waterfall: refresh Shopify → read Synarava → ONE compare → signals.
 */
export async function runProductConflictCheck({
  productId,
  locale,
  requestedBy,
}: {
  productId: string;
  locale?: string;
  requestedBy: string;
}): Promise<{
  signals: CatalogConflictSignals;
  warning?: string;
}> {
  return signalsFromWaterfall(
    { kind: "product", productId, locale },
    requestedBy,
    "PRODUCT",
  );
}

/** Catalog-wide Check — full waterfall. */
export async function runCatalogConflictCheck(requestedBy: string): Promise<{
  signals: CatalogConflictSignals;
  warning?: string;
}> {
  return signalsFromWaterfall({ kind: "catalog" }, requestedBy, "PRODUCT");
}

/** Scoped collection check. */
export async function runCollectionConflictCheck({
  collectionId,
  locale,
  requestedBy,
}: {
  collectionId: string;
  locale?: string;
  requestedBy: string;
}): Promise<{
  signals: CatalogConflictSignals;
  warning?: string;
}> {
  return signalsFromWaterfall(
    { kind: "collection", collectionId, locale },
    requestedBy,
    "COLLECTION",
  );
}

/** Full collection conflict sweep. */
export async function runCollectionsConflictCheck(requestedBy: string): Promise<{
  signals: CatalogConflictSignals;
  warning?: string;
}> {
  return signalsFromWaterfall({ kind: "collections" }, requestedBy, "COLLECTION");
}
