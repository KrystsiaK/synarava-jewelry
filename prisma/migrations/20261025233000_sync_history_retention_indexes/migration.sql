-- Additive indexes for sync history read paths + retention cleanup.
-- Generated offline via prisma migrate diff for createdAt; partial index hand-written
-- (Prisma schema cannot express WHERE on @@index).

-- Matches getLatestReconcileRun: ORDER BY "createdAt" DESC LIMIT 1
CREATE INDEX "ShopifyReconcileRun_createdAt_idx"
ON "ShopifyReconcileRun"("createdAt");

-- Matches getLatestReconcileDifferences ROW_NUMBER:
--   PARTITION BY "bindingId", "locale", "fieldKey"
--   ORDER BY "createdAt" DESC
--   WHERE "resolvedAt" IS NULL
CREATE INDEX "ShopifyFieldDivergence_open_partition_idx"
ON "ShopifyFieldDivergence" ("bindingId", "locale", "fieldKey", "createdAt" DESC)
WHERE "resolvedAt" IS NULL;
