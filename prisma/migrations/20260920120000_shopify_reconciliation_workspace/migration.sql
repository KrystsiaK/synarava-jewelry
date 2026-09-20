ALTER TABLE "AdminSession"
ADD COLUMN "lastShopifyReconcileAt" TIMESTAMP(3);

ALTER TABLE "TranslationSyncEvent"
ADD COLUMN "scope" JSONB,
ADD COLUMN "selectedSide" TEXT,
ADD COLUMN "localFingerprint" TEXT,
ADD COLUMN "shopifyFingerprint" TEXT,
ADD COLUMN "resultFingerprint" TEXT,
ADD COLUMN "shopifyResponse" JSONB;

CREATE TYPE "ShopifyReconcileTrigger" AS ENUM ('AUTO', 'MANUAL', 'ENTITY', 'LOCALE');
CREATE TYPE "ShopifyReconcileStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED');
CREATE TYPE "ShopifyTranslationTargetKind" AS ENUM ('NATIVE', 'METAFIELD', 'METAOBJECT');
CREATE TYPE "ShopifyFieldDifferenceKind" AS ENUM ('LOCAL_ONLY', 'SHOPIFY_ONLY', 'CONFLICT');

CREATE TABLE "ShopifyTranslationSnapshot" (
  "id" TEXT NOT NULL,
  "bindingId" TEXT NOT NULL,
  "locale" TEXT NOT NULL,
  "values" JSONB NOT NULL,
  "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ShopifyTranslationSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShopifyReconcileRun" (
  "id" TEXT NOT NULL,
  "trigger" "ShopifyReconcileTrigger" NOT NULL,
  "status" "ShopifyReconcileStatus" NOT NULL DEFAULT 'QUEUED',
  "scope" JSONB,
  "requestedBy" TEXT,
  "checkedCount" INTEGER NOT NULL DEFAULT 0,
  "differenceCount" INTEGER NOT NULL DEFAULT 0,
  "error" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ShopifyReconcileRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShopifyFieldDivergence" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "bindingId" TEXT NOT NULL,
  "rootEntityType" TEXT NOT NULL,
  "rootEntityId" TEXT NOT NULL,
  "entityLabel" TEXT NOT NULL,
  "locale" TEXT NOT NULL,
  "fieldKey" TEXT NOT NULL,
  "fieldLabel" TEXT NOT NULL,
  "targetKind" "ShopifyTranslationTargetKind" NOT NULL,
  "kind" "ShopifyFieldDifferenceKind" NOT NULL,
  "baseValue" JSONB,
  "localValue" JSONB,
  "shopifyValue" JSONB,
  "localFingerprint" TEXT NOT NULL,
  "shopifyFingerprint" TEXT NOT NULL,
  "shopifyUpdatedAt" TIMESTAMP(3),
  "shopifyOutdated" BOOLEAN,
  "resolutionToken" TEXT,
  "resolutionStartedAt" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ShopifyFieldDivergence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ShopifyTranslationSnapshot_bindingId_locale_key"
ON "ShopifyTranslationSnapshot"("bindingId", "locale");
CREATE INDEX "ShopifyTranslationSnapshot_locale_syncedAt_idx"
ON "ShopifyTranslationSnapshot"("locale", "syncedAt");
CREATE INDEX "ShopifyReconcileRun_status_createdAt_idx"
ON "ShopifyReconcileRun"("status", "createdAt");
CREATE INDEX "ShopifyReconcileRun_completedAt_idx"
ON "ShopifyReconcileRun"("completedAt");
CREATE UNIQUE INDEX "ShopifyFieldDivergence_runId_bindingId_locale_fieldKey_key"
ON "ShopifyFieldDivergence"("runId", "bindingId", "locale", "fieldKey");
CREATE INDEX "ShopifyFieldDivergence_bindingId_locale_idx"
ON "ShopifyFieldDivergence"("bindingId", "locale");
CREATE INDEX "ShopifyFieldDivergence_rootEntityType_rootEntityId_locale_idx"
ON "ShopifyFieldDivergence"("rootEntityType", "rootEntityId", "locale");
CREATE INDEX "ShopifyFieldDivergence_kind_resolvedAt_idx"
ON "ShopifyFieldDivergence"("kind", "resolvedAt");

ALTER TABLE "ShopifyTranslationSnapshot"
ADD CONSTRAINT "ShopifyTranslationSnapshot_bindingId_fkey"
FOREIGN KEY ("bindingId") REFERENCES "ShopifyTranslationBinding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ShopifyFieldDivergence"
ADD CONSTRAINT "ShopifyFieldDivergence_runId_fkey"
FOREIGN KEY ("runId") REFERENCES "ShopifyReconcileRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ShopifyFieldDivergence"
ADD CONSTRAINT "ShopifyFieldDivergence_bindingId_fkey"
FOREIGN KEY ("bindingId") REFERENCES "ShopifyTranslationBinding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve the existing PT common ancestor while reads migrate to the
-- locale-aware table. The deterministic suffix keeps this SQL idempotent
-- within Prisma's one-shot migration model without requiring an extension.
INSERT INTO "ShopifyTranslationSnapshot" (
  "id",
  "bindingId",
  "locale",
  "values",
  "syncedAt",
  "createdAt",
  "updatedAt"
)
SELECT
  "id" || '-pt-snapshot',
  "id",
  'pt-PT',
  "lastSyncedSnapshot",
  "updatedAt",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "ShopifyTranslationBinding"
WHERE "lastSyncedSnapshot" IS NOT NULL
ON CONFLICT ("bindingId", "locale") DO NOTHING;
