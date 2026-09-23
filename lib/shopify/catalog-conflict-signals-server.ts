import "server-only";

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getStorefrontLocales } from "@/lib/i18n/storefront-locale-cache";
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

export async function getCatalogConflictSignals(adminUsername?: string): Promise<CatalogConflictSignals> {
  const [commerceProducts, differences, presenceDifferences, locales, run, lastSuccessfulRuns, recentlyUpdatedProducts] = await Promise.all([
    db.product.findMany({ where: { syncStatus: "CONFLICT" }, select: { id: true } }),
    getLatestReconcileDifferences(),
    getLatestCatalogPresenceDifferences(),
    getStorefrontLocales(),
    getLatestReconcileRun(),
    db.$queryRaw<Array<{ completedAt: Date }>>(Prisma.sql`
      SELECT "completedAt"
      FROM "ShopifyReconcileRun"
      WHERE "status" = 'SUCCEEDED' AND "scope" IS NULL AND "trigger" IN ('AUTO', 'MANUAL')
      ORDER BY "completedAt" DESC
      LIMIT 1
    `),
    adminUsername ? listUnseenIncomingProductUpdates(adminUsername) : Promise.resolve([]),
  ]);

  return buildCatalogConflictSignals({
    commerceProductIds: commerceProducts.map((product) => product.id),
    differences,
    presenceDifferences,
    locales,
    run,
    lastSuccessfulFullCheckAt: lastSuccessfulRuns[0]?.completedAt.toISOString() ?? null,
    connected: hasShopifyAdminConfig(),
    recentlyUpdatedProducts,
    now: new Date(),
  });
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
  const failures: string[] = [];

  // Deliberately sequential: this is an explicit admin check and predictable
  // Shopify throttling is more important than a bursty catalog-wide request.
  for (const product of linkedProducts) {
    try {
      const inspection = await inspectProductSyncState(product.id);
      const persist = persistPayloadForCommerceInspection(inspection);
      if (persist) await db.product.update({ where: { id: product.id }, data: persist });
      if (persist?.syncStatus === "CONFLICT") commerceProductIds.push(product.id);
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
