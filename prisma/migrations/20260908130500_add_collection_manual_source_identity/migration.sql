-- Tracks the Shopify 2026-07 collection source owned by Synarava. Membership
-- pushes update only this source, leaving Shopify-authored rules untouched.
ALTER TABLE "Collection"
ADD COLUMN "shopifyManualSourceId" TEXT;

CREATE UNIQUE INDEX "Collection_shopifyManualSourceId_key"
ON "Collection"("shopifyManualSourceId");
