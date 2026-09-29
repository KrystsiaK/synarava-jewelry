-- Store only sha256(cookieSessionId) as ShopifyCustomerSession.id (matches AdminSession.tokenHash posture).
-- pgcrypto digest() matches Node createHash("sha256").update(id, "utf8").digest("hex").
CREATE EXTENSION IF NOT EXISTS pgcrypto;

UPDATE "ShopifyCustomerSession"
SET "id" = encode(digest("id", 'sha256'), 'hex');
