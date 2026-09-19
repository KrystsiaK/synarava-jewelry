ALTER TABLE "ProductTranslation" ADD COLUMN "localizedHandle" TEXT;
ALTER TABLE "CollectionTranslation" ADD COLUMN "localizedHandle" TEXT;
ALTER TABLE "PageTranslation" ADD COLUMN "localizedHandle" TEXT;

CREATE UNIQUE INDEX "ProductTranslation_localizedHandle_key" ON "ProductTranslation"("localizedHandle");
CREATE UNIQUE INDEX "CollectionTranslation_localizedHandle_key" ON "CollectionTranslation"("localizedHandle");
CREATE UNIQUE INDEX "PageTranslation_localizedHandle_key" ON "PageTranslation"("localizedHandle");

CREATE TABLE "LocalizedHandleRedirect" (
  "id" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "locale" "ContentLocale" NOT NULL,
  "fromHandle" TEXT NOT NULL,
  "toHandle" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LocalizedHandleRedirect_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LocalizedHandleRedirect_entityType_locale_fromHandle_key"
ON "LocalizedHandleRedirect"("entityType", "locale", "fromHandle");
CREATE INDEX "LocalizedHandleRedirect_entityType_entityId_locale_idx"
ON "LocalizedHandleRedirect"("entityType", "entityId", "locale");
