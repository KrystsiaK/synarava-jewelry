-- Separate the Shopify access token's expiry from the absolute lifetime of
-- the Synarava customer session, and add lastSeenAt for idle-timeout checks.
-- Existing rows are grandfathered to a predictable absolute expiry based on
-- when they were created (createdAt + 30 days), not a fresh 30-day window
-- granted at migration time.

ALTER TABLE "ShopifyCustomerSession" RENAME COLUMN "expiresAt" TO "accessTokenExpiresAt";
ALTER TABLE "ShopifyCustomerSession" ADD COLUMN "sessionExpiresAt" TIMESTAMP(3);
ALTER TABLE "ShopifyCustomerSession" ADD COLUMN "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT now();

UPDATE "ShopifyCustomerSession" SET "sessionExpiresAt" = "createdAt" + INTERVAL '30 days';

ALTER TABLE "ShopifyCustomerSession" ALTER COLUMN "sessionExpiresAt" SET NOT NULL;

DROP INDEX IF EXISTS "ShopifyCustomerSession_expiresAt_idx";
CREATE INDEX "ShopifyCustomerSession_accessTokenExpiresAt_idx" ON "ShopifyCustomerSession"("accessTokenExpiresAt");
CREATE INDEX "ShopifyCustomerSession_sessionExpiresAt_idx" ON "ShopifyCustomerSession"("sessionExpiresAt");
