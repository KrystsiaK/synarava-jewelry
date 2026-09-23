import "server-only";

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getStorefrontLocales } from "@/lib/i18n/storefront-locale-cache";
import { hasShopifyAdminConfig } from "@/lib/shopify/admin";
import { buildCatalogConflictSignals, type CatalogConflictSignals } from "@/lib/shopify/catalog-conflict-signals";
import { getLatestReconcileDifferences, getLatestReconcileRun } from "@/lib/shopify/reconciliation-run";
import { runTranslationReconciliation } from "@/lib/shopify/reconciliation-run";
import { inspectProductSyncState } from "@/lib/shopify/product-sync";
import { listUnseenIncomingProductUpdates } from "@/lib/shopify/catalog-conflict-review";

export async function getCatalogConflictSignals(adminUsername?: string): Promise<CatalogConflictSignals> {
  const [commerceProducts, differences, locales, run, lastSuccessfulRuns, recentlyUpdatedProducts] = await Promise.all([
    db.product.findMany({ where: { syncStatus: "CONFLICT" }, select: { id: true } }),
    getLatestReconcileDifferences(),
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
      if (inspection.state === "CONFLICT" && inspection.differences.length > 0) commerceProductIds.push(product.id);
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
    locales,
    run: translationRun.run,
    lastSuccessfulFullCheckAt: completedAt,
    connected: hasShopifyAdminConfig(),
    recentlyUpdatedProducts,
    now: new Date(),
  });

  if (failures.length > 0 && signals.state === "ready") signals.state = "failed";
  return {
    signals,
    warning: failures.length > 0
      ? `${failures.length} commerce product${failures.length === 1 ? "" : "s"} could not be checked.`
      : translationRun.run?.error ?? undefined,
  };
}
