-- Rollback for prisma/migrations/20261025214900_archive_and_drop_en_translation_rows
-- Restores locale='en' rows from archive tables. Does NOT undo base-column COALESCE
-- updates (those only filled nulls; re-running COALESCE is a no-op when base already set).
-- Run manually against the target DB after confirming archives exist.

INSERT INTO "ProductTranslation"
SELECT * FROM "_archive_product_translation_en" AS a
WHERE NOT EXISTS (
  SELECT 1 FROM "ProductTranslation" t
  WHERE t."productId" = a."productId" AND t.locale = 'en'
);

INSERT INTO "CollectionTranslation"
SELECT * FROM "_archive_collection_translation_en" AS a
WHERE NOT EXISTS (
  SELECT 1 FROM "CollectionTranslation" t
  WHERE t."collectionId" = a."collectionId" AND t.locale = 'en'
);

INSERT INTO "PageTranslation"
SELECT * FROM "_archive_page_translation_en" AS a
WHERE NOT EXISTS (
  SELECT 1 FROM "PageTranslation" t
  WHERE t."pageId" = a."pageId" AND t.locale = 'en'
);

-- Optional: drop archives after a successful restore + verification window.
-- DROP TABLE IF EXISTS "_archive_product_translation_en";
-- DROP TABLE IF EXISTS "_archive_collection_translation_en";
-- DROP TABLE IF EXISTS "_archive_page_translation_en";
