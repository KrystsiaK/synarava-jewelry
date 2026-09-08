-- Product.productType only ever held "ARTIFACT" — pull hard-coded it and
-- push then sent that back to Shopify, silently clobbering Shopify's real
-- productType on every push. Convert to a free-form nullable string that
-- mirrors Shopify's own field instead of a fixed local enum.
ALTER TABLE "Product" ALTER COLUMN "productType" DROP DEFAULT;
ALTER TABLE "Product" ALTER COLUMN "productType" TYPE TEXT USING "productType"::TEXT;
ALTER TABLE "Product" ALTER COLUMN "productType" DROP NOT NULL;
DROP TYPE "ProductType";
