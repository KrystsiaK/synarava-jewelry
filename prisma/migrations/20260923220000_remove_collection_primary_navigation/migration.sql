-- Remove legacy primary-nav ("department") collection membership and columns.
-- Shopify-linked former department collections stay as normal collections;
-- local-only seeded department collections are archived so they leave the shop filter.

DELETE FROM "ProductCollection"
WHERE "collectionId" IN (
  SELECT "id" FROM "Collection" WHERE "isPrimaryNav" = true
);

UPDATE "Collection"
SET
  "status" = 'DRAFT',
  "visibility" = 'PRIVATE',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE
  "isPrimaryNav" = true
  AND "shopifyCollectionId" IS NULL
  AND "slug" IN ('jewelry', 'pets', 'kids', 'jewelry-making');

ALTER TABLE "Collection"
DROP COLUMN "isPrimaryNav",
DROP COLUMN "navSortOrder";
