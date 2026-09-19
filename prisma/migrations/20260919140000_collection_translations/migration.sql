CREATE TABLE "CollectionTranslation" (
  "id" TEXT NOT NULL,
  "locale" "ContentLocale" NOT NULL,
  "name" TEXT NOT NULL,
  "subtitle" TEXT,
  "description" TEXT,
  "manifesto" TEXT,
  "symbolismLabel" TEXT,
  "symbolismTitle" TEXT,
  "symbolismBody" TEXT,
  "symbolismBody2" TEXT,
  "searchSummary" TEXT,
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
  "collectionId" TEXT NOT NULL,
  CONSTRAINT "CollectionTranslation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CollectionTranslation_collectionId_locale_key" ON "CollectionTranslation"("collectionId", "locale");
CREATE INDEX "CollectionTranslation_locale_reviewStatus_idx" ON "CollectionTranslation"("locale", "reviewStatus");
CREATE INDEX "CollectionTranslation_syncStatus_locale_idx" ON "CollectionTranslation"("syncStatus", "locale");

ALTER TABLE "CollectionTranslation" ADD CONSTRAINT "CollectionTranslation_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
