ALTER TABLE "Page"
  ADD COLUMN "shopifyPageId" TEXT,
  ADD COLUMN "shopifyHandle" TEXT;

CREATE UNIQUE INDEX "Page_shopifyPageId_key" ON "Page"("shopifyPageId");

CREATE TABLE "PageTranslation" (
  "id" TEXT NOT NULL,
  "locale" "ContentLocale" NOT NULL,
  "title" TEXT NOT NULL,
  "excerpt" TEXT,
  "content" JSONB,
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
  "pageId" TEXT NOT NULL,
  CONSTRAINT "PageTranslation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PageTranslation_pageId_locale_key" ON "PageTranslation"("pageId", "locale");
CREATE INDEX "PageTranslation_locale_reviewStatus_idx" ON "PageTranslation"("locale", "reviewStatus");
CREATE INDEX "PageTranslation_syncStatus_locale_idx" ON "PageTranslation"("syncStatus", "locale");

ALTER TABLE "PageTranslation"
  ADD CONSTRAINT "PageTranslation_pageId_fkey"
  FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "PageTranslation" (
  "id", "locale", "title", "excerpt", "content", "seoTitle", "seoDescription",
  "reviewStatus", "reviewedAt", "syncStatus", "createdAt", "updatedAt", "pageId"
)
SELECT
  'page_translation_en_' || md5("id"),
  'EN'::"ContentLocale",
  "title",
  "excerpt",
  COALESCE("content", '{}'::jsonb) - 'translations',
  "seoTitle",
  "seoDescription",
  'REVIEWED'::"TranslationReviewStatus",
  CURRENT_TIMESTAMP,
  'NOT_APPLICABLE'::"TranslationSyncStatus",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  "id"
FROM "Page";

INSERT INTO "PageTranslation" (
  "id", "locale", "title", "excerpt", "content", "seoTitle", "seoDescription",
  "reviewStatus", "syncStatus", "createdAt", "updatedAt", "pageId"
)
SELECT
  'page_translation_pt_' || md5("id"),
  'PT'::"ContentLocale",
  COALESCE(NULLIF("content" #>> '{translations,pt,title}', ''), "title"),
  NULLIF("content" #>> '{translations,pt,excerpt}', ''),
  COALESCE("content" #> '{translations,pt}', '{}'::jsonb) - 'title' - 'excerpt',
  NULL,
  NULL,
  'DRAFT'::"TranslationReviewStatus",
  'NOT_APPLICABLE'::"TranslationSyncStatus",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  "id"
FROM "Page"
WHERE "content" #> '{translations,pt}' IS NOT NULL;
