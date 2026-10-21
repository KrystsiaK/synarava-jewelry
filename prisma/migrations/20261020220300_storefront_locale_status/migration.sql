-- CreateEnum
CREATE TYPE "StorefrontLocaleStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'RETIRED');

-- AlterTable
ALTER TABLE "StorefrontLocale" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "retiredAt" TIMESTAMP(3),
ADD COLUMN     "status" "StorefrontLocaleStatus" NOT NULL DEFAULT 'DRAFT';

-- Backfill: keep isPublished denormalized; publish rows that were live.
UPDATE "StorefrontLocale"
SET "status" = 'PUBLISHED'
WHERE "isPublished" = true;

UPDATE "StorefrontLocale"
SET "status" = 'DRAFT'
WHERE "isPublished" = false;

-- CreateIndex
CREATE INDEX "StorefrontLocale_status_idx" ON "StorefrontLocale"("status");
