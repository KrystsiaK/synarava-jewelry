import "server-only";

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getStorefrontLocales } from "@/lib/i18n/storefront-locale-cache";
import { hasShopifyAdminConfig } from "@/lib/shopify/admin";
import { buildCatalogConflictSignals, type CatalogConflictSignals } from "@/lib/shopify/catalog-conflict-signals";
import { getLatestReconcileDifferences, getLatestReconcileRun } from "@/lib/shopify/reconciliation-run";

export async function getCatalogConflictSignals(): Promise<CatalogConflictSignals> {
  const [commerceProducts, differences, locales, run, lastSuccessfulRuns] = await Promise.all([
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
  ]);

  return buildCatalogConflictSignals({
    commerceProductIds: commerceProducts.map((product) => product.id),
    differences,
    locales,
    run,
    lastSuccessfulFullCheckAt: lastSuccessfulRuns[0]?.completedAt.toISOString() ?? null,
    connected: hasShopifyAdminConfig(),
    now: new Date(),
  });
}
