import "server-only";

import { db } from "@/lib/db";

/** Keep sync audit rows this long; older eligible rows may be deleted. */
export const SYNC_HISTORY_RETENTION_DAYS = 90;

/** Max rows deleted per statement (batched DELETE). */
export const SYNC_HISTORY_CLEANUP_BATCH_SIZE = 500;

export type SyncHistoryCleanupStats = {
  divergences: number;
  reconcileRuns: number;
  productSyncEvents: number;
  translationSyncEvents: number;
  webhookDeliveries: number;
};

export type CleanupSyncHistoryOptions = {
  olderThanDays?: number;
  batchSize?: number;
  /** Cap rounds per table. Default 1 (opportunistic). Use a high number for a full drain. */
  maxBatches?: number;
  now?: Date;
};

function emptyStats(): SyncHistoryCleanupStats {
  return {
    divergences: 0,
    reconcileRuns: 0,
    productSyncEvents: 0,
    translationSyncEvents: 0,
    webhookDeliveries: 0,
  };
}

function cutoffDate(olderThanDays: number, now: Date): Date {
  return new Date(now.getTime() - olderThanDays * 24 * 60 * 60 * 1000);
}

async function deleteResolvedDivergencesBatch(cutoff: Date, batchSize: number): Promise<number> {
  // Only resolved rows — open conflicts stay for getLatestReconcileDifferences.
  return db.$executeRaw`
    WITH doomed AS (
      SELECT "id"
      FROM "ShopifyFieldDivergence"
      WHERE "resolvedAt" IS NOT NULL
        AND "resolvedAt" < ${cutoff}
      ORDER BY "resolvedAt" ASC
      LIMIT ${batchSize}
    )
    DELETE FROM "ShopifyFieldDivergence" AS row
    USING doomed
    WHERE row."id" = doomed."id"
  `;
}

async function deleteFinishedReconcileRunsBatch(cutoff: Date, batchSize: number): Promise<number> {
  // Finished only. Skip runs that still own unresolved divergences so cascade
  // cannot wipe the open-conflict SoT used by getLatestReconcileDifferences.
  // Never delete the newest full catalog run (null scope, AUTO/MANUAL) — that
  // row is the SoT for top-bar checkedAt / last-check status.
  return db.$executeRaw`
    WITH newest_full AS (
      SELECT run."id"
      FROM "ShopifyReconcileRun" AS run
      WHERE run."trigger" IN (
          CAST('AUTO' AS "ShopifyReconcileTrigger"),
          CAST('MANUAL' AS "ShopifyReconcileTrigger")
        )
        AND (run."scope" IS NULL OR run."scope" = 'null'::jsonb)
      ORDER BY run."createdAt" DESC
      LIMIT 1
    ),
    doomed AS (
      SELECT run."id"
      FROM "ShopifyReconcileRun" AS run
      WHERE run."status" IN (
          CAST('SUCCEEDED' AS "ShopifyReconcileStatus"),
          CAST('PARTIAL' AS "ShopifyReconcileStatus"),
          CAST('FAILED' AS "ShopifyReconcileStatus")
        )
        AND run."createdAt" < ${cutoff}
        AND run."id" NOT IN (SELECT "id" FROM newest_full)
        AND NOT EXISTS (
          SELECT 1
          FROM "ShopifyFieldDivergence" AS difference
          WHERE difference."runId" = run."id"
            AND difference."resolvedAt" IS NULL
        )
      ORDER BY run."createdAt" ASC
      LIMIT ${batchSize}
    )
    DELETE FROM "ShopifyReconcileRun" AS run
    USING doomed
    WHERE run."id" = doomed."id"
  `;
}

async function deleteProductSyncEventsBatch(cutoff: Date, batchSize: number): Promise<number> {
  return db.$executeRaw`
    WITH doomed AS (
      SELECT "id"
      FROM "ProductSyncEvent"
      WHERE "createdAt" < ${cutoff}
      ORDER BY "createdAt" ASC
      LIMIT ${batchSize}
    )
    DELETE FROM "ProductSyncEvent" AS row
    USING doomed
    WHERE row."id" = doomed."id"
  `;
}

async function deleteTranslationSyncEventsBatch(cutoff: Date, batchSize: number): Promise<number> {
  return db.$executeRaw`
    WITH doomed AS (
      SELECT "id"
      FROM "TranslationSyncEvent"
      WHERE "createdAt" < ${cutoff}
      ORDER BY "createdAt" ASC
      LIMIT ${batchSize}
    )
    DELETE FROM "TranslationSyncEvent" AS row
    USING doomed
    WHERE row."id" = doomed."id"
  `;
}

async function deleteWebhookDeliveriesBatch(cutoff: Date, batchSize: number): Promise<number> {
  return db.$executeRaw`
    WITH doomed AS (
      SELECT "id"
      FROM "ShopifyWebhookDelivery"
      WHERE "createdAt" < ${cutoff}
      ORDER BY "createdAt" ASC
      LIMIT ${batchSize}
    )
    DELETE FROM "ShopifyWebhookDelivery" AS row
    USING doomed
    WHERE row."id" = doomed."id"
  `;
}

async function drain(
  deleteBatch: () => Promise<number>,
  maxBatches: number,
  batchSize: number,
): Promise<number> {
  let total = 0;
  for (let round = 0; round < maxBatches; round += 1) {
    const deleted = await deleteBatch();
    total += deleted;
    // Empty or partial batch means nothing older remains for this table.
    if (deleted < batchSize) break;
  }
  return total;
}

/**
 * Batched retention cleanup for sync audit tables (90-day default).
 * Scheduled drain: owner Railway cron — docs/runbooks/sync-history-cleanup-railway.md (REL-010).
 * Opportunistic one-batch call from the admin catalog check remains a supplement.
 */
export async function cleanupSyncHistory(
  options: CleanupSyncHistoryOptions = {},
): Promise<SyncHistoryCleanupStats> {
  const olderThanDays = options.olderThanDays ?? SYNC_HISTORY_RETENTION_DAYS;
  const batchSize = options.batchSize ?? SYNC_HISTORY_CLEANUP_BATCH_SIZE;
  const maxBatches = options.maxBatches ?? 1;
  const cutoff = cutoffDate(olderThanDays, options.now ?? new Date());

  const stats = emptyStats();
  stats.divergences = await drain(
    () => deleteResolvedDivergencesBatch(cutoff, batchSize),
    maxBatches,
    batchSize,
  );
  stats.reconcileRuns = await drain(
    () => deleteFinishedReconcileRunsBatch(cutoff, batchSize),
    maxBatches,
    batchSize,
  );
  stats.productSyncEvents = await drain(
    () => deleteProductSyncEventsBatch(cutoff, batchSize),
    maxBatches,
    batchSize,
  );
  stats.translationSyncEvents = await drain(
    () => deleteTranslationSyncEventsBatch(cutoff, batchSize),
    maxBatches,
    batchSize,
  );
  stats.webhookDeliveries = await drain(
    () => deleteWebhookDeliveriesBatch(cutoff, batchSize),
    maxBatches,
    batchSize,
  );
  return stats;
}

/** Best-effort one-batch cleanup; never throws (admin check must stay green). */
export async function cleanupSyncHistoryBestEffort(): Promise<void> {
  try {
    await cleanupSyncHistory({ maxBatches: 1 });
  } catch (error) {
    console.error("[sync-history-retention] cleanup failed", error);
  }
}
