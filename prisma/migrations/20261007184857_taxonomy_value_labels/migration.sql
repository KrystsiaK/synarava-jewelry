-- CreateEnum
CREATE TYPE "TaxonomyValueKind" AS ENUM ('CATEGORY_LEAF', 'PRODUCT_TYPE');

-- CreateEnum
CREATE TYPE "TaxonomyValueLabelSource" AS ENUM ('SHOPIFY', 'SYNARAVA', 'SEED_MAP');

-- CreateTable
CREATE TABLE "TaxonomyValueLabel" (
    "id" TEXT NOT NULL,
    "kind" "TaxonomyValueKind" NOT NULL,
    "enValue" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "source" "TaxonomyValueLabelSource" NOT NULL DEFAULT 'SYNARAVA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxonomyValueLabel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaxonomyValueLabel_locale_kind_idx" ON "TaxonomyValueLabel"("locale", "kind");

-- CreateIndex
CREATE INDEX "TaxonomyValueLabel_enValue_idx" ON "TaxonomyValueLabel"("enValue");

-- CreateIndex
CREATE UNIQUE INDEX "TaxonomyValueLabel_kind_enValue_locale_key" ON "TaxonomyValueLabel"("kind", "enValue", "locale");
