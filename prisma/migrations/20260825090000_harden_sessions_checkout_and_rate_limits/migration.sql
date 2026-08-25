-- Revocable administrative sessions.
CREATE TABLE "AdminSession" (
    "id" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdminSession_tokenHash_key" ON "AdminSession"("tokenHash");
CREATE INDEX "AdminSession_username_idx" ON "AdminSession"("username");
CREATE INDEX "AdminSession_expiresAt_idx" ON "AdminSession"("expiresAt");

-- Shared, database-backed throttling survives process restarts and serverless fan-out.
CREATE TABLE "RateLimitBucket" (
    "keyHash" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "resetAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("keyHash")
);

CREATE INDEX "RateLimitBucket_resetAt_idx" ON "RateLimitBucket"("resetAt");

-- Existing draft orders intentionally receive no access token. They must restart
-- checkout once after this migration instead of retaining an insecure ID-only cookie.
ALTER TABLE "Order" ADD COLUMN "checkoutAccessTokenHash" TEXT;
ALTER TABLE "Order" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX "Order_checkoutAccessTokenHash_key" ON "Order"("checkoutAccessTokenHash");

ALTER TABLE "AuditLog" ADD COLUMN "adminSessionId" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "adminUsername" TEXT;
CREATE INDEX "AuditLog_adminSessionId_createdAt_idx" ON "AuditLog"("adminSessionId", "createdAt");
