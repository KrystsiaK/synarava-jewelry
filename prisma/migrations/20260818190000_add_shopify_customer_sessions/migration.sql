CREATE TABLE "ShopifyCustomerSession" (
    "id" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "idToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopifyCustomerSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ShopifyCustomerSession_expiresAt_idx" ON "ShopifyCustomerSession"("expiresAt");
