-- Read-only pre-merge check: English translation rows vs base columns.
-- Owner runs against staging and reviews any differing / en-only fields.
-- SELECT only — no writes.

-- Summary counts
SELECT 'ProductTranslation' AS table_name, COUNT(*)::bigint AS en_rows
FROM "ProductTranslation" WHERE locale = 'en'
UNION ALL
SELECT 'CollectionTranslation', COUNT(*)::bigint
FROM "CollectionTranslation" WHERE locale = 'en'
UNION ALL
SELECT 'PageTranslation', COUNT(*)::bigint
FROM "PageTranslation" WHERE locale = 'en';

-- Product: fields that differ (base vs en row) or are en-only (base null, en set)
SELECT
  p.id AS entity_id,
  p.slug,
  'product' AS kind,
  CASE
    WHEN NULLIF(BTRIM(p."name"), '') IS DISTINCT FROM NULLIF(BTRIM(en."title"), '') THEN 'name/title'
    WHEN p."shortDescription" IS DISTINCT FROM en."shortDescription" THEN 'shortDescription'
    WHEN p."description" IS DISTINCT FROM en."description" THEN 'description'
    WHEN p."materialLine" IS DISTINCT FROM en."materialLine" THEN 'materialLine'
    WHEN p."symbolismLabel" IS DISTINCT FROM en."symbolismLabel" THEN 'symbolismLabel'
    WHEN p."symbolismTitle" IS DISTINCT FROM en."symbolismTitle" THEN 'symbolismTitle'
    WHEN p."symbolismBody" IS DISTINCT FROM en."symbolismBody" THEN 'symbolismBody'
    WHEN p."symbolismBody2" IS DISTINCT FROM en."symbolismBody2" THEN 'symbolismBody2'
    WHEN p."details" IS DISTINCT FROM en."details" THEN 'details'
    WHEN p."seoTitle" IS DISTINCT FROM en."seoTitle" THEN 'seoTitle'
    WHEN p."seoDescription" IS DISTINCT FROM en."seoDescription" THEN 'seoDescription'
    WHEN p."slug" IS DISTINCT FROM COALESCE(en."localizedHandle", p."slug") AND en."localizedHandle" IS NOT NULL THEN 'slug/localizedHandle'
    ELSE NULL
  END AS differing_field,
  p."name" AS base_name,
  en."title" AS en_title,
  p."shortDescription" AS base_shortDescription,
  en."shortDescription" AS en_shortDescription,
  p."description" AS base_description,
  en."description" AS en_description,
  p."seoTitle" AS base_seoTitle,
  en."seoTitle" AS en_seoTitle,
  p."seoDescription" AS base_seoDescription,
  en."seoDescription" AS en_seoDescription,
  en."localizedHandle" AS en_localizedHandle
FROM "Product" p
INNER JOIN "ProductTranslation" en ON en."productId" = p.id AND en.locale = 'en'
WHERE
  NULLIF(BTRIM(p."name"), '') IS DISTINCT FROM NULLIF(BTRIM(en."title"), '')
  OR p."shortDescription" IS DISTINCT FROM en."shortDescription"
  OR p."description" IS DISTINCT FROM en."description"
  OR p."materialLine" IS DISTINCT FROM en."materialLine"
  OR p."symbolismLabel" IS DISTINCT FROM en."symbolismLabel"
  OR p."symbolismTitle" IS DISTINCT FROM en."symbolismTitle"
  OR p."symbolismBody" IS DISTINCT FROM en."symbolismBody"
  OR p."symbolismBody2" IS DISTINCT FROM en."symbolismBody2"
  OR p."details" IS DISTINCT FROM en."details"
  OR p."seoTitle" IS DISTINCT FROM en."seoTitle"
  OR p."seoDescription" IS DISTINCT FROM en."seoDescription"
  OR (en."localizedHandle" IS NOT NULL AND p."slug" IS DISTINCT FROM en."localizedHandle")
ORDER BY p.slug;

-- Collection diffs
SELECT
  c.id AS entity_id,
  c.slug,
  'collection' AS kind,
  c."name" AS base_name,
  en."name" AS en_name,
  c."subtitle" AS base_subtitle,
  en."subtitle" AS en_subtitle,
  c."description" AS base_description,
  en."description" AS en_description,
  c."manifesto" AS base_manifesto,
  en."manifesto" AS en_manifesto,
  c."storyTitle" AS base_storyTitle,
  en."storyTitle" AS en_storyTitle,
  c."storyBody" AS base_storyBody,
  en."storyBody" AS en_storyBody,
  c."ctaLabel" AS base_ctaLabel,
  en."ctaLabel" AS en_ctaLabel,
  c."heroImageAlt" AS base_heroImageAlt,
  en."heroImageAlt" AS en_heroImageAlt,
  c."seoTitle" AS base_seoTitle,
  en."seoTitle" AS en_seoTitle,
  c."seoDescription" AS base_seoDescription,
  en."seoDescription" AS en_seoDescription,
  en."localizedHandle" AS en_localizedHandle
FROM "Collection" c
INNER JOIN "CollectionTranslation" en ON en."collectionId" = c.id AND en.locale = 'en'
WHERE
  NULLIF(BTRIM(c."name"), '') IS DISTINCT FROM NULLIF(BTRIM(en."name"), '')
  OR c."subtitle" IS DISTINCT FROM en."subtitle"
  OR c."description" IS DISTINCT FROM en."description"
  OR c."manifesto" IS DISTINCT FROM en."manifesto"
  OR c."storyTitle" IS DISTINCT FROM en."storyTitle"
  OR c."storyBody" IS DISTINCT FROM en."storyBody"
  OR c."symbolismLabel" IS DISTINCT FROM en."symbolismLabel"
  OR c."symbolismTitle" IS DISTINCT FROM en."symbolismTitle"
  OR c."symbolismBody" IS DISTINCT FROM en."symbolismBody"
  OR c."symbolismBody2" IS DISTINCT FROM en."symbolismBody2"
  OR c."searchSummary" IS DISTINCT FROM en."searchSummary"
  OR c."ctaLabel" IS DISTINCT FROM en."ctaLabel"
  OR c."heroImageAlt" IS DISTINCT FROM en."heroImageAlt"
  OR c."seoTitle" IS DISTINCT FROM en."seoTitle"
  OR c."seoDescription" IS DISTINCT FROM en."seoDescription"
  OR (en."localizedHandle" IS NOT NULL AND c."slug" IS DISTINCT FROM en."localizedHandle")
ORDER BY c.slug;

-- Page diffs (English content is Page base columns; en row is the redundant mirror)
SELECT
  pg.id AS entity_id,
  pg.slug,
  'page' AS kind,
  pg."title" AS base_title,
  en."title" AS en_title,
  pg."excerpt" AS base_excerpt,
  en."excerpt" AS en_excerpt,
  pg."seoTitle" AS base_seoTitle,
  en."seoTitle" AS en_seoTitle,
  pg."seoDescription" AS base_seoDescription,
  en."seoDescription" AS en_seoDescription,
  (pg."content" IS DISTINCT FROM en."content") AS content_differs,
  en."localizedHandle" AS en_localizedHandle
FROM "Page" pg
INNER JOIN "PageTranslation" en ON en."pageId" = pg.id AND en.locale = 'en'
WHERE
  NULLIF(BTRIM(pg."title"), '') IS DISTINCT FROM NULLIF(BTRIM(en."title"), '')
  OR pg."excerpt" IS DISTINCT FROM en."excerpt"
  OR pg."content" IS DISTINCT FROM en."content"
  OR pg."seoTitle" IS DISTINCT FROM en."seoTitle"
  OR pg."seoDescription" IS DISTINCT FROM en."seoDescription"
  OR (en."localizedHandle" IS NOT NULL AND pg."slug" IS DISTINCT FROM en."localizedHandle")
ORDER BY pg.slug;

-- En-only field fills that COALESCE would apply (base null, en set)
SELECT 'product' AS kind, p.id, p.slug, 'shortDescription' AS field
FROM "Product" p
JOIN "ProductTranslation" en ON en."productId" = p.id AND en.locale = 'en'
WHERE p."shortDescription" IS NULL AND en."shortDescription" IS NOT NULL
UNION ALL
SELECT 'product', p.id, p.slug, 'description'
FROM "Product" p
JOIN "ProductTranslation" en ON en."productId" = p.id AND en.locale = 'en'
WHERE p."description" IS NULL AND en."description" IS NOT NULL
UNION ALL
SELECT 'product', p.id, p.slug, 'seoTitle'
FROM "Product" p
JOIN "ProductTranslation" en ON en."productId" = p.id AND en.locale = 'en'
WHERE p."seoTitle" IS NULL AND en."seoTitle" IS NOT NULL
UNION ALL
SELECT 'product', p.id, p.slug, 'seoDescription'
FROM "Product" p
JOIN "ProductTranslation" en ON en."productId" = p.id AND en.locale = 'en'
WHERE p."seoDescription" IS NULL AND en."seoDescription" IS NOT NULL
UNION ALL
SELECT 'collection', c.id, c.slug, 'subtitle'
FROM "Collection" c
JOIN "CollectionTranslation" en ON en."collectionId" = c.id AND en.locale = 'en'
WHERE c."subtitle" IS NULL AND en."subtitle" IS NOT NULL
UNION ALL
SELECT 'collection', c.id, c.slug, 'seoTitle'
FROM "Collection" c
JOIN "CollectionTranslation" en ON en."collectionId" = c.id AND en.locale = 'en'
WHERE c."seoTitle" IS NULL AND en."seoTitle" IS NOT NULL
UNION ALL
SELECT 'collection', c.id, c.slug, 'seoDescription'
FROM "Collection" c
JOIN "CollectionTranslation" en ON en."collectionId" = c.id AND en.locale = 'en'
WHERE c."seoDescription" IS NULL AND en."seoDescription" IS NOT NULL
UNION ALL
SELECT 'page', pg.id, pg.slug, 'excerpt'
FROM "Page" pg
JOIN "PageTranslation" en ON en."pageId" = pg.id AND en.locale = 'en'
WHERE pg."excerpt" IS NULL AND en."excerpt" IS NOT NULL
UNION ALL
SELECT 'page', pg.id, pg.slug, 'content'
FROM "Page" pg
JOIN "PageTranslation" en ON en."pageId" = pg.id AND en.locale = 'en'
WHERE pg."content" IS NULL AND en."content" IS NOT NULL
UNION ALL
SELECT 'page', pg.id, pg.slug, 'seoTitle'
FROM "Page" pg
JOIN "PageTranslation" en ON en."pageId" = pg.id AND en.locale = 'en'
WHERE pg."seoTitle" IS NULL AND en."seoTitle" IS NOT NULL
UNION ALL
SELECT 'page', pg.id, pg.slug, 'seoDescription'
FROM "Page" pg
JOIN "PageTranslation" en ON en."pageId" = pg.id AND en.locale = 'en'
WHERE pg."seoDescription" IS NULL AND en."seoDescription" IS NOT NULL
ORDER BY kind, slug, field;
