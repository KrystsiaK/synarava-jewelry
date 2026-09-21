-- CreateTable
CREATE TABLE "StorefrontLocale" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "routeSegment" TEXT NOT NULL,
    "shopifyLocale" TEXT NOT NULL,
    "intlLocale" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nativeName" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "shopifyUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StorefrontLocale_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StorefrontLocale_code_key" ON "StorefrontLocale"("code");

-- CreateIndex
CREATE UNIQUE INDEX "StorefrontLocale_routeSegment_key" ON "StorefrontLocale"("routeSegment");

-- CreateIndex
CREATE UNIQUE INDEX "StorefrontLocale_shopifyLocale_key" ON "StorefrontLocale"("shopifyLocale");

-- CreateIndex
CREATE INDEX "StorefrontLocale_sortOrder_idx" ON "StorefrontLocale"("sortOrder");

-- Backfill: existing EN/PT locales become registry rows. EN is the source
-- locale; PT keeps its current /pt route segment even though its Shopify
-- locale is pt-PT (see tasks/universal-localization-plan.md).
INSERT INTO "StorefrontLocale"
  ("id", "code", "routeSegment", "shopifyLocale", "intlLocale", "name", "nativeName", "isDefault", "isPublished", "sortOrder", "updatedAt")
VALUES
  ('storefront-locale-en', 'en', 'en', 'en', 'en', 'English', 'English', true, true, 0, CURRENT_TIMESTAMP),
  ('storefront-locale-pt', 'pt', 'pt', 'pt-PT', 'pt-PT', 'Portuguese', 'Português', false, true, 1, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;
