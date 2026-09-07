-- Expand-only: add Shopify collection identity to the local collection
-- projection. Nullable and additive so existing local-only collections
-- keep working unlinked until pull/push populates the Shopify GID.
ALTER TABLE "Collection"
ADD COLUMN "shopifyCollectionId" TEXT,
ADD COLUMN "shopifyHandle" TEXT,
ADD COLUMN "lastSyncedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Collection_shopifyCollectionId_key" ON "Collection"("shopifyCollectionId");
