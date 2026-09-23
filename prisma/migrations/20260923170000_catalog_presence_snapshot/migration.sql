CREATE TABLE "ShopifyCatalogPresenceSnapshot" (
    "id" TEXT NOT NULL DEFAULT 'catalog',
    "runId" TEXT,
    "differences" JSONB NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ShopifyCatalogPresenceSnapshot_pkey" PRIMARY KEY ("id")
);
