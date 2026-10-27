-- Archive + delete redundant English translation rows.
-- English lives only on Product / Collection / Page base columns.
-- Translation tables keep non-default locales only.
-- Rollback SQL: scripts/db/rollback-en-translation-rows.sql

-- 1) Full-copy archives (all columns) — additive, safe to leave.
CREATE TABLE "_archive_product_translation_en" AS
SELECT * FROM "ProductTranslation" WHERE locale = 'en';

CREATE TABLE "_archive_collection_translation_en" AS
SELECT * FROM "CollectionTranslation" WHERE locale = 'en';

CREATE TABLE "_archive_page_translation_en" AS
SELECT * FROM "PageTranslation" WHERE locale = 'en';

-- 2) Coalesce: for fields present on BOTH base and translation, fill null base
--    from the en row. Base wins when both are set (COALESCE(base, en)).
--    Mapped names: ProductTranslation.title → Product.name;
--    *.localizedHandle → *.slug (only when base slug is null — slug is normally required).

UPDATE "Product" AS p
SET
  "name" = COALESCE(NULLIF(BTRIM(p."name"), ''), en."title"),
  "shortDescription" = COALESCE(p."shortDescription", en."shortDescription"),
  "description" = COALESCE(p."description", en."description"),
  "materialLine" = COALESCE(p."materialLine", en."materialLine"),
  "symbolismLabel" = COALESCE(p."symbolismLabel", en."symbolismLabel"),
  "symbolismTitle" = COALESCE(p."symbolismTitle", en."symbolismTitle"),
  "symbolismBody" = COALESCE(p."symbolismBody", en."symbolismBody"),
  "symbolismBody2" = COALESCE(p."symbolismBody2", en."symbolismBody2"),
  "details" = COALESCE(p."details", en."details"),
  "seoTitle" = COALESCE(p."seoTitle", en."seoTitle"),
  "seoDescription" = COALESCE(p."seoDescription", en."seoDescription"),
  "slug" = COALESCE(NULLIF(BTRIM(p."slug"), ''), en."localizedHandle", p."slug")
FROM "ProductTranslation" AS en
WHERE en."productId" = p."id" AND en.locale = 'en';

UPDATE "Collection" AS c
SET
  "name" = COALESCE(NULLIF(BTRIM(c."name"), ''), en."name"),
  "subtitle" = COALESCE(c."subtitle", en."subtitle"),
  "description" = COALESCE(c."description", en."description"),
  "manifesto" = COALESCE(c."manifesto", en."manifesto"),
  "storyTitle" = COALESCE(c."storyTitle", en."storyTitle"),
  "storyBody" = COALESCE(c."storyBody", en."storyBody"),
  "symbolismLabel" = COALESCE(c."symbolismLabel", en."symbolismLabel"),
  "symbolismTitle" = COALESCE(c."symbolismTitle", en."symbolismTitle"),
  "symbolismBody" = COALESCE(c."symbolismBody", en."symbolismBody"),
  "symbolismBody2" = COALESCE(c."symbolismBody2", en."symbolismBody2"),
  "searchSummary" = COALESCE(c."searchSummary", en."searchSummary"),
  "ctaLabel" = COALESCE(c."ctaLabel", en."ctaLabel"),
  "heroImageAlt" = COALESCE(c."heroImageAlt", en."heroImageAlt"),
  "seoTitle" = COALESCE(c."seoTitle", en."seoTitle"),
  "seoDescription" = COALESCE(c."seoDescription", en."seoDescription"),
  "slug" = COALESCE(NULLIF(BTRIM(c."slug"), ''), en."localizedHandle", c."slug")
FROM "CollectionTranslation" AS en
WHERE en."collectionId" = c."id" AND en.locale = 'en';

UPDATE "Page" AS pg
SET
  "title" = COALESCE(NULLIF(BTRIM(pg."title"), ''), en."title"),
  "excerpt" = COALESCE(pg."excerpt", en."excerpt"),
  "content" = COALESCE(pg."content", en."content"),
  "seoTitle" = COALESCE(pg."seoTitle", en."seoTitle"),
  "seoDescription" = COALESCE(pg."seoDescription", en."seoDescription"),
  "slug" = COALESCE(NULLIF(BTRIM(pg."slug"), ''), en."localizedHandle", pg."slug")
FROM "PageTranslation" AS en
WHERE en."pageId" = pg."id" AND en.locale = 'en';

-- 3) Verify archive row counts match rows about to be deleted.
DO $$
DECLARE
  archive_product_count integer;
  live_product_count integer;
  archive_collection_count integer;
  live_collection_count integer;
  archive_page_count integer;
  live_page_count integer;
BEGIN
  SELECT COUNT(*) INTO archive_product_count FROM "_archive_product_translation_en";
  SELECT COUNT(*) INTO live_product_count FROM "ProductTranslation" WHERE locale = 'en';
  IF archive_product_count <> live_product_count THEN
    RAISE EXCEPTION 'ProductTranslation en archive count % != live %', archive_product_count, live_product_count;
  END IF;

  SELECT COUNT(*) INTO archive_collection_count FROM "_archive_collection_translation_en";
  SELECT COUNT(*) INTO live_collection_count FROM "CollectionTranslation" WHERE locale = 'en';
  IF archive_collection_count <> live_collection_count THEN
    RAISE EXCEPTION 'CollectionTranslation en archive count % != live %', archive_collection_count, live_collection_count;
  END IF;

  SELECT COUNT(*) INTO archive_page_count FROM "_archive_page_translation_en";
  SELECT COUNT(*) INTO live_page_count FROM "PageTranslation" WHERE locale = 'en';
  IF archive_page_count <> live_page_count THEN
    RAISE EXCEPTION 'PageTranslation en archive count % != live %', archive_page_count, live_page_count;
  END IF;
END $$;

-- 4) Delete English translation rows (archive remains for rollback).
DELETE FROM "ProductTranslation" WHERE locale = 'en';
DELETE FROM "CollectionTranslation" WHERE locale = 'en';
DELETE FROM "PageTranslation" WHERE locale = 'en';
