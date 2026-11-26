-- Synarava-only necklace↔charm links (not Shopify sync). Additive only.

CREATE TABLE "ProductPairing" (
    "id" TEXT NOT NULL,
    "baseProductId" TEXT NOT NULL,
    "addonProductId" TEXT NOT NULL,
    "imageAssetId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductPairing_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductPairing_baseProductId_addonProductId_key" ON "ProductPairing"("baseProductId", "addonProductId");

CREATE INDEX "ProductPairing_addonProductId_idx" ON "ProductPairing"("addonProductId");

ALTER TABLE "ProductPairing" ADD CONSTRAINT "ProductPairing_baseProductId_fkey" FOREIGN KEY ("baseProductId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductPairing" ADD CONSTRAINT "ProductPairing_addonProductId_fkey" FOREIGN KEY ("addonProductId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductPairing" ADD CONSTRAINT "ProductPairing_imageAssetId_fkey" FOREIGN KEY ("imageAssetId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
