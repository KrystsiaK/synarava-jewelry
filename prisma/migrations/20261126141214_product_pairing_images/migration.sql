-- Multi-photo pair gallery: join table replaces ProductPairing.imageAssetId (ADR-0013).

CREATE TABLE "ProductPairingImage" (
    "id" TEXT NOT NULL,
    "pairingId" TEXT NOT NULL,
    "imageAssetId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductPairingImage_pkey" PRIMARY KEY ("id")
);

-- Move existing single pair photos before dropping the column.
INSERT INTO "ProductPairingImage" ("id", "pairingId", "imageAssetId", "sortOrder", "createdAt", "updatedAt")
SELECT
    gen_random_uuid()::text,
    "id",
    "imageAssetId",
    0,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "ProductPairing"
WHERE "imageAssetId" IS NOT NULL;

CREATE UNIQUE INDEX "ProductPairingImage_pairingId_imageAssetId_key" ON "ProductPairingImage"("pairingId", "imageAssetId");

CREATE INDEX "ProductPairingImage_pairingId_sortOrder_idx" ON "ProductPairingImage"("pairingId", "sortOrder");

CREATE INDEX "ProductPairingImage_imageAssetId_idx" ON "ProductPairingImage"("imageAssetId");

ALTER TABLE "ProductPairingImage" ADD CONSTRAINT "ProductPairingImage_pairingId_fkey" FOREIGN KEY ("pairingId") REFERENCES "ProductPairing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductPairingImage" ADD CONSTRAINT "ProductPairingImage_imageAssetId_fkey" FOREIGN KEY ("imageAssetId") REFERENCES "MediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductPairing" DROP CONSTRAINT "ProductPairing_imageAssetId_fkey";

ALTER TABLE "ProductPairing" DROP COLUMN "imageAssetId";
