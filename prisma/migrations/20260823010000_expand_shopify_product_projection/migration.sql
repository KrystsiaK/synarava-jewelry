ALTER TABLE "Product"
ADD COLUMN "vendor" TEXT,
ADD COLUMN "shopifyCategoryId" TEXT,
ADD COLUMN "shopifyCategoryName" TEXT,
ADD COLUMN "shopifySnapshot" JSONB;

ALTER TABLE "ProductVariant"
ADD COLUMN "barcode" TEXT,
ADD COLUMN "taxable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "requiresShipping" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "tracked" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "weightGrams" DECIMAL(14,4),
ADD COLUMN "imageUrl" TEXT,
ADD COLUMN "selectedOptions" JSONB;
