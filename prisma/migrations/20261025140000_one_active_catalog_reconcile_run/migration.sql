-- Enforce at most one QUEUED/RUNNING Shopify reconcile run (single-flight).
-- First fail any duplicate active rows so the unique index can be created.

WITH ranked AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (ORDER BY "createdAt" DESC, "id" DESC) AS rn
  FROM "ShopifyReconcileRun"
  WHERE "status" IN ('QUEUED', 'RUNNING')
)
UPDATE "ShopifyReconcileRun" AS run
SET
  "status" = CAST('FAILED' AS "ShopifyReconcileStatus"),
  "error" = COALESCE(
    run."error",
    'Superseded: duplicate active reconcile run closed before unique index.'
  ),
  "completedAt" = COALESCE(run."completedAt", CURRENT_TIMESTAMP),
  "updatedAt" = CURRENT_TIMESTAMP
FROM ranked
WHERE run."id" = ranked."id"
  AND ranked.rn > 1
  AND run."status" IN ('QUEUED', 'RUNNING');

-- Partial unique index: only one active (QUEUED/RUNNING) row may exist.
CREATE UNIQUE INDEX "ShopifyReconcileRun_one_active_idx"
ON "ShopifyReconcileRun" ((true))
WHERE "status" IN ('QUEUED', 'RUNNING');
