-- CreateEnum
CREATE TYPE "ContentLocale" AS ENUM ('EN', 'PT');

-- CreateEnum
CREATE TYPE "TranslationReviewStatus" AS ENUM ('DRAFT', 'REVIEWED');

-- CreateEnum
CREATE TYPE "TranslationSyncStatus" AS ENUM ('NOT_APPLICABLE', 'PENDING', 'SYNCED', 'FAILED', 'CONFLICT');

-- CreateTable
CREATE TABLE "ProductTranslation" (
    "id" TEXT NOT NULL,
    "locale" "ContentLocale" NOT NULL,
    "title" TEXT NOT NULL,
    "shortDescription" TEXT,
    "description" TEXT,
    "materialLine" TEXT,
    "symbolismLabel" TEXT,
    "symbolismTitle" TEXT,
    "symbolismBody" TEXT,
    "symbolismBody2" TEXT,
    "details" JSONB,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "reviewStatus" "TranslationReviewStatus" NOT NULL DEFAULT 'DRAFT',
    "reviewedAt" TIMESTAMP(3),
    "syncStatus" "TranslationSyncStatus" NOT NULL DEFAULT 'NOT_APPLICABLE',
    "syncError" TEXT,
    "contentHash" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "productId" TEXT NOT NULL,

    CONSTRAINT "ProductTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "coverAssetId" TEXT,
    "status" "PageStatus" NOT NULL DEFAULT 'DRAFT',
    "visibility" "ContentVisibility" NOT NULL DEFAULT 'PRIVATE',
    "publishedAt" TIMESTAMP(3),
    "authoredByUsername" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostTranslation" (
    "id" TEXT NOT NULL,
    "locale" "ContentLocale" NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT,
    "body" TEXT,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "reviewStatus" "TranslationReviewStatus" NOT NULL DEFAULT 'DRAFT',
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "postId" TEXT NOT NULL,

    CONSTRAINT "PostTranslation_pkey" PRIMARY KEY ("id")
);

-- Backfill the existing product copy as the canonical English translation.
INSERT INTO "ProductTranslation" (
    "id", "locale", "title", "shortDescription", "description", "materialLine",
    "symbolismLabel", "symbolismTitle", "symbolismBody", "symbolismBody2", "details",
    "seoTitle", "seoDescription", "reviewStatus", "reviewedAt", "syncStatus", "createdAt", "updatedAt", "productId"
)
SELECT
    CONCAT("id", ':en'), 'EN', "name", "shortDescription", "description", "materialLine",
    "symbolismLabel", "symbolismTitle", "symbolismBody", "symbolismBody2", "details",
    "seoTitle", "seoDescription", 'REVIEWED', CURRENT_TIMESTAMP, 'NOT_APPLICABLE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, "id"
FROM "Product"
ON CONFLICT DO NOTHING;

-- CreateIndex
CREATE UNIQUE INDEX "ProductTranslation_productId_locale_key" ON "ProductTranslation"("productId", "locale");
CREATE INDEX "ProductTranslation_locale_reviewStatus_idx" ON "ProductTranslation"("locale", "reviewStatus");
CREATE INDEX "ProductTranslation_syncStatus_locale_idx" ON "ProductTranslation"("syncStatus", "locale");
CREATE UNIQUE INDEX "Post_slug_key" ON "Post"("slug");
CREATE INDEX "Post_status_visibility_publishedAt_idx" ON "Post"("status", "visibility", "publishedAt");
CREATE UNIQUE INDEX "PostTranslation_postId_locale_key" ON "PostTranslation"("postId", "locale");
CREATE INDEX "PostTranslation_locale_reviewStatus_idx" ON "PostTranslation"("locale", "reviewStatus");

-- AddForeignKey
ALTER TABLE "ProductTranslation" ADD CONSTRAINT "ProductTranslation_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Post" ADD CONSTRAINT "Post_coverAssetId_fkey" FOREIGN KEY ("coverAssetId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PostTranslation" ADD CONSTRAINT "PostTranslation_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
