import "server-only";

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { COMMERCE_SYNC_STORE_ID } from "@/lib/commerce-store/refresh";
import type { CommerceStoreConflict } from "@/lib/commerce-store/types";
import { getPublishedStorefrontLocales, getStorefrontLocales } from "@/lib/i18n/storefront-locale-cache";
import { hasShopifyAdminConfig } from "@/lib/shopify/admin";
import { buildCatalogConflictSignals, type CatalogConflictSignals } from "@/lib/shopify/catalog-conflict-signals";
import { getLatestReconcileDifferences, getLatestReconcileRun } from "@/lib/shopify/reconciliation-run";
import { runTranslationReconciliation } from "@/lib/shopify/reconciliation-run";
import { inspectProductSyncState } from "@/lib/shopify/product-sync";
import { persistPayloadForCommerceInspection } from "@/lib/shopify/catalog-conflict-policy";
import { listUnseenIncomingProductUpdates } from "@/lib/shopify/catalog-conflict-review";
import {
  getLatestCatalogPresenceDifferences,
  scanAndSaveCatalogPresence,
} from "@/lib/shopify/catalog-presence-server";
import {
  getLatestCollectionPresenceCheckedAt,
  getLatestCollectionPresenceDifferences,
  scanAndSaveCollectionPresence,
} from "@/lib/shopify/collection-presence-server";

/** Field-diff totals from the dual-store conflict report (local product id → count). */
async function commerceFieldCountsFromStore(): Promise<Record<string, number>> {
  const row = await db.commerceSyncStore.findUnique({
    where: { id: COMMERCE_SYNC_STORE_ID },
    select: { conflictReport: true },
  });
  if (!row?.conflictReport || !Array.isArray(row.conflictReport)) return {};
  const counts: Record<string, number> = {};
  for (const entry of row.conflictReport as CommerceStoreConflict[]) {
    const productId = entry.localProductId;
    if (!productId || !Array.isArray(entry.differences)) continue;
    const fieldDiffs = entry.differences.filter((diff) => diff.path !== "_presence");
    if (fieldDiffs.length === 0) continue;
    counts[productId] = fieldDiffs.length;
  }
  return counts;
}

async function resolveShopifyLocale(registryCode: string): Promise<string | null> {
  if (registryCode === "en") return "en";
  const locales = await getPublishedStorefrontLocales();
  return locales.find((locale) => !locale.isDefault && locale.code === registryCode)?.shopifyLocale ?? null;
}

async function lastSuccessfulFullCheckAt(): Promise<string | null> {
  const rows = await db.$queryRaw<Array<{ completedAt: Date }>>(Prisma.sql`
    SELECT "completedAt"
    FROM "ShopifyReconcileRun"
    WHERE "status" = 'SUCCEEDED' AND "scope" IS NULL AND "trigger" IN ('AUTO', 'MANUAL')
    ORDER BY "completedAt" DESC
    LIMIT 1
  `);
  return rows[0]?.completedAt.toISOString() ?? null;
}

/** Latest collection-wide check: presence snapshot and/or COLLECTION-scoped full reconcile. */
async function lastSuccessfulCollectionCheckAt(): Promise<string | null> {
  const [presenceCheckedAt, rows] = await Promise.all([
    getLatestCollectionPresenceCheckedAt(),
    db.$queryRaw<Array<{ completedAt: Date }>>(Prisma.sql`
      SELECT "completedAt"
      FROM "ShopifyReconcileRun"
      WHERE "status" = 'SUCCEEDED'
        AND "trigger" IN ('AUTO', 'MANUAL')
        AND "scope" IS NOT NULL
        AND ("scope"::jsonb->>'entityType') = 'COLLECTION'
        AND (("scope"::jsonb->>'entityId') IS NULL)
      ORDER BY "completedAt" DESC
      LIMIT 1
    `),
  ]);
  const reconcileAt = rows[0]?.completedAt.toISOString() ?? null;
  if (presenceCheckedAt && reconcileAt) {
    return new Date(presenceCheckedAt).getTime() >= new Date(reconcileAt).getTime()
      ? presenceCheckedAt
      : reconcileAt;
  }
  return presenceCheckedAt ?? reconcileAt;
}

export async function getCatalogConflictSignals(adminUsername?: string): Promise<CatalogConflictSignals> {
  const [commerceProducts, differences, presenceDifferences, locales, run, checkedAt, recentlyUpdatedProducts, commerceFieldCounts] = await Promise.all([
    db.product.findMany({ where: { syncStatus: "CONFLICT" }, select: { id: true } }),
    getLatestReconcileDifferences(),
    getLatestCatalogPresenceDifferences(),
    getStorefrontLocales(),
    getLatestReconcileRun(),
    lastSuccessfulFullCheckAt(),
    adminUsername ? listUnseenIncomingProductUpdates(adminUsername) : Promise.resolve([]),
    commerceFieldCountsFromStore(),
  ]);

  return buildCatalogConflictSignals({
    commerceProductIds: commerceProducts.map((product) => product.id),
    commerceFieldCounts,
    differences,
    presenceDifferences,
    locales,
    run,
    lastSuccessfulFullCheckAt: checkedAt,
    connected: hasShopifyAdminConfig(),
    recentlyUpdatedProducts,
    now: new Date(),
    rootEntityType: "PRODUCT",
  });
}

/** Same signal shape as products; `products` map holds collection IDs (translation + presence). */
export async function getCollectionConflictSignals(): Promise<CatalogConflictSignals> {
  const [differences, presenceDifferences, locales, run, checkedAt] = await Promise.all([
    getLatestReconcileDifferences(),
    getLatestCollectionPresenceDifferences(),
    getStorefrontLocales(),
    getLatestReconcileRun(),
    lastSuccessfulCollectionCheckAt(),
  ]);

  return buildCatalogConflictSignals({
    commerceProductIds: [],
    differences,
    presenceDifferences,
    locales,
    run,
    lastSuccessfulFullCheckAt: checkedAt,
    connected: hasShopifyAdminConfig(),
    recentlyUpdatedProducts: [],
    now: new Date(),
    rootEntityType: "COLLECTION",
  });
}

/**
 * Scoped conflict check for one product (optional locale). Does not sweep the full catalog.
 * Registry locale codes ("pt", "ru") are resolved to Shopify locale codes before reconcile.
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
  const shopifyLocale = locale ? await resolveShopifyLocale(locale) : null;
  if (locale && !shopifyLocale) {
    return {
      signals: await getCatalogConflictSignals(requestedBy),
      warning: `Locale ${locale} is not published in Shopify Markets.`,
    };
  }

  const translationRun = await runTranslationReconciliation({
    trigger: "LOCALE",
    requestedBy,
    scope: {
      entityType: "PRODUCT",
      entityId: productId,
      ...(shopifyLocale ? { locale: shopifyLocale } : {}),
    },
  });

  const commerceProductIds: string[] = [];
  const commerceFieldCounts: Record<string, number> = {};
  const failures: string[] = [];
  try {
    const inspection = await inspectProductSyncState(productId);
    const persist = persistPayloadForCommerceInspection(inspection);
    if (persist) await db.product.update({ where: { id: productId }, data: persist });
    if (persist?.syncStatus === "CONFLICT") {
      commerceProductIds.push(productId);
      commerceFieldCounts[productId] = inspection.differences.length;
    }
  } catch (error) {
    failures.push(error instanceof Error ? error.message : `Could not inspect ${productId}.`);
  }

  // Keep other products that already have CONFLICT status in the signal map so the
  // catalog list does not silently drop them after a scoped editor check.
  const otherConflicted = await db.product.findMany({
    where: { syncStatus: "CONFLICT", id: { not: productId } },
    select: { id: true },
  });
  for (const product of otherConflicted) {
    if (!commerceProductIds.includes(product.id)) commerceProductIds.push(product.id);
  }

  const [differences, presenceDifferences, locales, recentlyUpdatedProducts] = await Promise.all([
    getLatestReconcileDifferences(),
    getLatestCatalogPresenceDifferences(),
    getStorefrontLocales(),
    listUnseenIncomingProductUpdates(requestedBy),
  ]);

  const signals = buildCatalogConflictSignals({
    commerceProductIds,
    commerceFieldCounts,
    differences,
    presenceDifferences,
    locales,
    run: translationRun.run,
    lastSuccessfulFullCheckAt: translationRun.run?.status === "SUCCEEDED" ? translationRun.run.completedAt : null,
    connected: hasShopifyAdminConfig(),
    recentlyUpdatedProducts,
    now: new Date(),
  });

  if (failures.length > 0 && signals.state === "ready") signals.state = "failed";
  const warnings = [
    failures.length > 0 ? failures.join(" ") : undefined,
    translationRun.run?.error ?? undefined,
  ].filter((warning): warning is string => Boolean(warning));

  return {
    signals,
    warning: warnings.length > 0 ? warnings.join(" ") : undefined,
  };
}

/** Runs a real Shopify-backed sweep and returns the fresh signal directly, without relying on webhook-age commerce flags. */
export async function runCatalogConflictCheck(requestedBy: string): Promise<{
  signals: CatalogConflictSignals;
  warning?: string;
}> {
  const translationRun = await runTranslationReconciliation({ trigger: "MANUAL", requestedBy });
  let presenceDifferences;
  let presenceWarning: string | undefined;
  try {
    presenceDifferences = await scanAndSaveCatalogPresence(translationRun.run?.id ?? null);
  } catch (error) {
    presenceDifferences = await getLatestCatalogPresenceDifferences();
    presenceWarning = error instanceof Error ? error.message : "Catalog presence could not be checked.";
  }
  const linkedProducts = await db.product.findMany({
    where: { shopifyProductId: { not: null } },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  const commerceProductIds: string[] = [];
  const commerceFieldCounts: Record<string, number> = {};
  const failures: string[] = [];

  // Deliberately sequential: this is an explicit admin check and predictable
  // Shopify throttling is more important than a bursty catalog-wide request.
  for (const product of linkedProducts) {
    try {
      const inspection = await inspectProductSyncState(product.id);
      const persist = persistPayloadForCommerceInspection(inspection);
      if (persist) await db.product.update({ where: { id: product.id }, data: persist });
      if (persist?.syncStatus === "CONFLICT") {
        commerceProductIds.push(product.id);
        commerceFieldCounts[product.id] = inspection.differences.length;
      }
    } catch (error) {
      failures.push(error instanceof Error ? error.message : `Could not inspect ${product.id}.`);
    }
  }

  const [differences, locales, recentlyUpdatedProducts] = await Promise.all([
    getLatestReconcileDifferences(),
    getStorefrontLocales(),
    listUnseenIncomingProductUpdates(requestedBy),
  ]);
  const completedAt = translationRun.run?.status === "SUCCEEDED" ? translationRun.run.completedAt : null;
  const signals = buildCatalogConflictSignals({
    commerceProductIds,
    commerceFieldCounts,
    differences,
    presenceDifferences,
    locales,
    run: translationRun.run,
    lastSuccessfulFullCheckAt: completedAt,
    connected: hasShopifyAdminConfig(),
    recentlyUpdatedProducts,
    now: new Date(),
  });

  if ((failures.length > 0 || presenceWarning) && signals.state === "ready") signals.state = "failed";
  const warnings = [
    failures.length > 0
      ? `${failures.length} commerce product${failures.length === 1 ? "" : "s"} could not be checked.`
      : undefined,
    presenceWarning ? `Catalog presence could not be checked: ${presenceWarning}` : undefined,
    translationRun.run?.error ?? undefined,
  ].filter((warning): warning is string => Boolean(warning));

  return {
    signals,
    warning: warnings.length > 0 ? warnings.join(" ") : undefined,
  };
}

/**
 * Scoped conflict check for one collection (optional locale). Does not sweep
 * products or other entity types — translation reconcile + latest presence snapshot.
 */
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
  const shopifyLocale = locale ? await resolveShopifyLocale(locale) : null;
  if (locale && !shopifyLocale) {
    return {
      signals: await getCollectionConflictSignals(),
      warning: `Locale ${locale} is not published in Shopify Markets.`,
    };
  }

  const translationRun = await runTranslationReconciliation({
    trigger: "LOCALE",
    requestedBy,
    scope: {
      entityType: "COLLECTION",
      entityId: collectionId,
      ...(shopifyLocale ? { locale: shopifyLocale } : {}),
    },
  });

  const [differences, presenceDifferences, locales, checkedAt] = await Promise.all([
    getLatestReconcileDifferences(),
    getLatestCollectionPresenceDifferences(),
    getStorefrontLocales(),
    lastSuccessfulCollectionCheckAt(),
  ]);

  const signals = buildCatalogConflictSignals({
    commerceProductIds: [],
    differences,
    presenceDifferences,
    locales,
    run: translationRun.run,
    lastSuccessfulFullCheckAt: checkedAt,
    connected: hasShopifyAdminConfig(),
    recentlyUpdatedProducts: [],
    now: new Date(),
    rootEntityType: "COLLECTION",
  });

  return {
    signals,
    warning: translationRun.run?.error ?? undefined,
  };
}

/** Full collection conflict sweep: translation reconcile + catalog presence. */
export async function runCollectionsConflictCheck(requestedBy: string): Promise<{
  signals: CatalogConflictSignals;
  warning?: string;
}> {
  const translationRun = await runTranslationReconciliation({
    trigger: "MANUAL",
    requestedBy,
    scope: { entityType: "COLLECTION" },
  });

  let presenceDifferences;
  let presenceWarning: string | undefined;
  try {
    presenceDifferences = await scanAndSaveCollectionPresence(translationRun.run?.id ?? null);
  } catch (error) {
    presenceDifferences = await getLatestCollectionPresenceDifferences();
    presenceWarning = error instanceof Error ? error.message : "Collection presence could not be checked.";
  }

  const [differences, locales] = await Promise.all([
    getLatestReconcileDifferences(),
    getStorefrontLocales(),
  ]);
  const completedAt = translationRun.run?.status === "SUCCEEDED" ? translationRun.run.completedAt : null;
  const presenceCheckedAt = await getLatestCollectionPresenceCheckedAt();
  const checkedAt = [completedAt, presenceCheckedAt]
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0]
    ?? null;
  const signals = buildCatalogConflictSignals({
    commerceProductIds: [],
    differences,
    presenceDifferences,
    locales,
    run: translationRun.run,
    lastSuccessfulFullCheckAt: checkedAt,
    connected: hasShopifyAdminConfig(),
    recentlyUpdatedProducts: [],
    now: new Date(),
    rootEntityType: "COLLECTION",
  });

  if (presenceWarning && signals.state === "ready") signals.state = "failed";
  const warnings = [
    presenceWarning ? `Collection presence could not be checked: ${presenceWarning}` : undefined,
    translationRun.run?.error ?? undefined,
  ].filter((warning): warning is string => Boolean(warning));

  return {
    signals,
    warning: warnings.length > 0 ? warnings.join(" ") : undefined,
  };
}
