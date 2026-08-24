CREATE TYPE "ProductSyncStatus" AS ENUM ('UNLINKED', 'PENDING', 'SYNCED', 'CONFLICT', 'FAILED');
CREATE TYPE "CharacteristicValueType" AS ENUM ('TEXT', 'NUMBER', 'BOOLEAN');
CREATE TYPE "SyncDirection" AS ENUM ('PUSH', 'PULL', 'RECONCILE');
CREATE TYPE "SyncEventStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CONFLICT', 'IGNORED');

ALTER TABLE "Product"
ADD COLUMN "shopifyProductId" TEXT,
ADD COLUMN "shopifyHandle" TEXT,
ADD COLUMN "shopifyUpdatedAt" TIMESTAMP(3),
ADD COLUMN "lastSyncedAt" TIMESTAMP(3),
ADD COLUMN "syncStatus" "ProductSyncStatus" NOT NULL DEFAULT 'UNLINKED',
ADD COLUMN "syncError" TEXT,
ADD COLUMN "searchDocument" TEXT;

ALTER TABLE "ProductVariant"
ADD COLUMN "shopifyVariantId" TEXT,
ADD COLUMN "shopifyInventoryItemId" TEXT;

CREATE TABLE "ProductCharacteristic" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "group" TEXT NOT NULL,
  "valueType" "CharacteristicValueType" NOT NULL,
  "textValue" TEXT,
  "numberValue" DECIMAL(14,4),
  "booleanValue" BOOLEAN,
  "unit" TEXT,
  "certificateUrl" TEXT,
  "searchable" BOOLEAN NOT NULL DEFAULT true,
  "filterable" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductCharacteristic_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductSyncEvent" (
  "id" TEXT NOT NULL,
  "productId" TEXT,
  "shopifyProductId" TEXT,
  "shopifyWebhookId" TEXT,
  "direction" "SyncDirection" NOT NULL,
  "status" "SyncEventStatus" NOT NULL DEFAULT 'PENDING',
  "topic" TEXT,
  "payload" JSONB,
  "error" TEXT,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "ProductSyncEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Product_shopifyProductId_key" ON "Product"("shopifyProductId");
CREATE UNIQUE INDEX "ProductVariant_shopifyVariantId_key" ON "ProductVariant"("shopifyVariantId");
CREATE UNIQUE INDEX "ProductVariant_shopifyInventoryItemId_key" ON "ProductVariant"("shopifyInventoryItemId");
CREATE UNIQUE INDEX "ProductCharacteristic_productId_key_key" ON "ProductCharacteristic"("productId", "key");
CREATE INDEX "ProductCharacteristic_key_textValue_idx" ON "ProductCharacteristic"("key", "textValue");
CREATE INDEX "ProductCharacteristic_key_numberValue_idx" ON "ProductCharacteristic"("key", "numberValue");
CREATE INDEX "ProductCharacteristic_key_booleanValue_idx" ON "ProductCharacteristic"("key", "booleanValue");
CREATE INDEX "ProductCharacteristic_productId_group_sortOrder_idx" ON "ProductCharacteristic"("productId", "group", "sortOrder");
CREATE UNIQUE INDEX "ProductSyncEvent_shopifyWebhookId_key" ON "ProductSyncEvent"("shopifyWebhookId");
CREATE INDEX "ProductSyncEvent_productId_createdAt_idx" ON "ProductSyncEvent"("productId", "createdAt");
CREATE INDEX "ProductSyncEvent_status_createdAt_idx" ON "ProductSyncEvent"("status", "createdAt");
CREATE INDEX "ProductSyncEvent_shopifyProductId_idx" ON "ProductSyncEvent"("shopifyProductId");

ALTER TABLE "ProductCharacteristic" ADD CONSTRAINT "ProductCharacteristic_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductSyncEvent" ADD CONSTRAINT "ProductSyncEvent_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
