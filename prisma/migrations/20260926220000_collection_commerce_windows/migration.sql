-- AlterTable
ALTER TABLE "Collection" ADD COLUMN IF NOT EXISTS "shopifySnapshot" JSONB;
ALTER TABLE "Collection" ADD COLUMN IF NOT EXISTS "workingSnapshot" JSONB;
ALTER TABLE "Collection" ADD COLUMN IF NOT EXISTS "shopifyUpdatedAt" TIMESTAMP(3);
ALTER TABLE "Collection" ADD COLUMN IF NOT EXISTS "syncStatus" "ProductSyncStatus" NOT NULL DEFAULT 'UNLINKED';
ALTER TABLE "Collection" ADD COLUMN IF NOT EXISTS "syncError" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Collection_syncStatus_idx" ON "Collection"("syncStatus");
