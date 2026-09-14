-- Flags the one collection whose manual Shopify order drives /shop's
-- default "Featured" sort when no collection filter is selected (global
-- product priority). The partial unique index keeps that a singleton.
ALTER TABLE "Collection"
ADD COLUMN "isStorefrontDefault" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "Collection_isStorefrontDefault_key"
ON "Collection"("isStorefrontDefault")
WHERE "isStorefrontDefault" = true;
