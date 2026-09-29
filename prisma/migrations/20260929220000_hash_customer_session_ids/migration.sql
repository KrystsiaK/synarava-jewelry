-- Customer session cookie ids are hashed in application code
-- (lib/shopify/customer-account/session-store.ts):
--   • new rows always insert sha256(cookieId)
--   • reads dual-lookup hash then legacy plaintext pk, then promote in place
--
-- No CREATE EXTENSION / bulk rewrite here: that needed pgcrypto privileges and
-- created a deploy-order race (old code after a SQL rewrite cannot find rows).
-- Optional one-shot cleanup can be run manually after the new code is live:
--   CREATE EXTENSION IF NOT EXISTS pgcrypto;
--   UPDATE "ShopifyCustomerSession"
--   SET "id" = encode(digest("id", 'sha256'), 'hex')
--   WHERE length("id") <> 64 OR "id" !~ '^[0-9a-f]+$';

SELECT 1;
