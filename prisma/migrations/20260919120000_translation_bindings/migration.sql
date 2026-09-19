CREATE TYPE "TranslationResourceType" AS ENUM ('PRODUCT', 'COLLECTION', 'PAGE', 'METAOBJECT');

CREATE TABLE "ShopifyTranslationBinding" (
  "id" TEXT NOT NULL,
  "resourceType" "TranslationResourceType" NOT NULL,
  "entityId" TEXT NOT NULL,
  "shopifyResourceId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ShopifyTranslationBinding_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TranslationSyncEvent" (
  "id" TEXT NOT NULL,
  "bindingId" TEXT NOT NULL,
  "locale" "ContentLocale" NOT NULL,
  "direction" "SyncDirection" NOT NULL,
  "status" "SyncEventStatus" NOT NULL DEFAULT 'PENDING',
  "fieldConflicts" JSONB,
  "error" TEXT,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "TranslationSyncEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ShopifyTranslationBinding_resourceType_entityId_key" ON "ShopifyTranslationBinding"("resourceType", "entityId");
CREATE UNIQUE INDEX "ShopifyTranslationBinding_resourceType_shopifyResourceId_key" ON "ShopifyTranslationBinding"("resourceType", "shopifyResourceId");
CREATE INDEX "TranslationSyncEvent_bindingId_createdAt_idx" ON "TranslationSyncEvent"("bindingId", "createdAt");
CREATE INDEX "TranslationSyncEvent_status_createdAt_idx" ON "TranslationSyncEvent"("status", "createdAt");

ALTER TABLE "TranslationSyncEvent" ADD CONSTRAINT "TranslationSyncEvent_bindingId_fkey" FOREIGN KEY ("bindingId") REFERENCES "ShopifyTranslationBinding"("id") ON DELETE CASCADE ON UPDATE CASCADE;
