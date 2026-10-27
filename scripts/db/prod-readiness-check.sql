-- Production readiness checks (SELECT only — safe to paste in Railway Data / Query).
-- Nothing here mutates data. Scripts and docs only; nothing runs in production by itself.
--
-- How to run (Railway Data tab)
--   1. Railway project → production environment → Postgres service → Data (Query).
--   2. Confirm the connection banner shows the production Postgres (not staging).
--   3. Set expected_shop in section 1 to the live myshopify domain (not a secret).
--   4. Paste ONE statement / section at a time (Railway may wrap or LIMIT SELECT).
--   5. Review each result before continuing. Do not paste DROP/UPDATE/INSERT from other files.
--
-- Never paste DATABASE_URL, tokens, or passwords into chat or this file.
-- Related: docs/runbooks/release-prod.md, docs/runbooks/post-cutover-cleanup.md

-- =============================================================================
-- 1) shopify.store_binding present and equals expected shop
-- =============================================================================
-- Change only the literal in `expected(shop)` — example: synarava.myshopify.com
WITH expected(shop) AS (
  SELECT lower(trim(both FROM 'synarava.myshopify.com'))
)
SELECT
  'store_binding' AS check_name,
  EXISTS (
    SELECT 1 FROM "SiteSetting" WHERE key = 'shopify.store_binding'
  ) AS binding_row_present,
  lower(
    trim(
      both FROM coalesce(
        "SiteSetting".value ->> 'shopDomain',
        ''
      )
    )
  ) AS bound_shop_domain,
  expected.shop AS expected_shop_domain,
  CASE
    WHEN NOT EXISTS (
      SELECT 1 FROM "SiteSetting" s WHERE s.key = 'shopify.store_binding'
    ) THEN 'FAIL: missing SiteSetting shopify.store_binding'
    WHEN lower(
      trim(
        both FROM coalesce(
          "SiteSetting".value ->> 'shopDomain',
          ''
        )
      )
    ) IS DISTINCT FROM expected.shop THEN 'FAIL: bound shop ≠ expected'
    ELSE 'OK'
  END AS verdict
FROM expected
LEFT JOIN "SiteSetting"
  ON "SiteSetting".key = 'shopify.store_binding';

-- =============================================================================
-- 2) No QUEUED / RUNNING ShopifyReconcileRun
-- =============================================================================
SELECT
  'active_reconcile_runs' AS check_name,
  COUNT(*)::bigint AS active_count,
  CASE
    WHEN COUNT(*) = 0 THEN 'OK'
    ELSE 'FAIL: QUEUED or RUNNING reconcile run present'
  END AS verdict
FROM "ShopifyReconcileRun"
WHERE status IN ('QUEUED', 'RUNNING');

SELECT
  id,
  status,
  trigger,
  "createdAt",
  "startedAt"
FROM "ShopifyReconcileRun"
WHERE status IN ('QUEUED', 'RUNNING')
ORDER BY "createdAt" DESC;

-- =============================================================================
-- 3a) Archive tables exist (safe even when a table is missing)
-- =============================================================================
SELECT
  'archive_presence' AS check_name,
  to_regclass('public._archive_product_working_snapshot') IS NOT NULL AS product_ws_archive,
  to_regclass('public._archive_collection_working_snapshot') IS NOT NULL AS collection_ws_archive,
  to_regclass('public._archive_product_translation_en') IS NOT NULL AS product_tr_en_archive,
  to_regclass('public._archive_collection_translation_en') IS NOT NULL AS collection_tr_en_archive,
  to_regclass('public._archive_page_translation_en') IS NOT NULL AS page_tr_en_archive,
  CASE
    WHEN to_regclass('public._archive_product_working_snapshot') IS NULL
      OR to_regclass('public._archive_collection_working_snapshot') IS NULL
      OR to_regclass('public._archive_product_translation_en') IS NULL
      OR to_regclass('public._archive_collection_translation_en') IS NULL
      OR to_regclass('public._archive_page_translation_en') IS NULL
    THEN 'FAIL: one or more _archive_* tables missing'
    ELSE 'OK'
  END AS verdict;

-- =============================================================================
-- 3b) Working-snapshot archives: row counts must equal live sources
--     Run only after 3a shows both working-snapshot archives present.
-- =============================================================================
SELECT
  'archive_product_working_snapshot' AS check_name,
  (SELECT COUNT(*)::bigint FROM "Product") AS source_count,
  (SELECT COUNT(*)::bigint FROM "_archive_product_working_snapshot") AS archive_count,
  CASE
    WHEN (SELECT COUNT(*)::bigint FROM "_archive_product_working_snapshot")
      = (SELECT COUNT(*)::bigint FROM "Product") THEN 'OK'
    ELSE 'FAIL: archive_count ≠ Product count'
  END AS verdict;

SELECT
  'archive_collection_working_snapshot' AS check_name,
  (SELECT COUNT(*)::bigint FROM "Collection") AS source_count,
  (SELECT COUNT(*)::bigint FROM "_archive_collection_working_snapshot") AS archive_count,
  CASE
    WHEN (SELECT COUNT(*)::bigint FROM "_archive_collection_working_snapshot")
      = (SELECT COUNT(*)::bigint FROM "Collection") THEN 'OK'
    ELSE 'FAIL: archive_count ≠ Collection count'
  END AS verdict;

-- =============================================================================
-- 3c) EN translation archives exist + counts; live en rows should be 0
--     (sources were moved into archives). Run after 3a shows all three present.
-- =============================================================================
SELECT
  'archive_product_translation_en' AS check_name,
  (SELECT COUNT(*)::bigint FROM "ProductTranslation" WHERE locale = 'en') AS live_en_source_count,
  (SELECT COUNT(*)::bigint FROM "_archive_product_translation_en") AS archive_count,
  CASE
    WHEN (SELECT COUNT(*)::bigint FROM "ProductTranslation" WHERE locale = 'en') = 0 THEN 'OK'
    ELSE 'WARN: live en ProductTranslation rows still present'
  END AS verdict;

SELECT
  'archive_collection_translation_en' AS check_name,
  (SELECT COUNT(*)::bigint FROM "CollectionTranslation" WHERE locale = 'en') AS live_en_source_count,
  (SELECT COUNT(*)::bigint FROM "_archive_collection_translation_en") AS archive_count,
  CASE
    WHEN (SELECT COUNT(*)::bigint FROM "CollectionTranslation" WHERE locale = 'en') = 0 THEN 'OK'
    ELSE 'WARN: live en CollectionTranslation rows still present'
  END AS verdict;

SELECT
  'archive_page_translation_en' AS check_name,
  (SELECT COUNT(*)::bigint FROM "PageTranslation" WHERE locale = 'en') AS live_en_source_count,
  (SELECT COUNT(*)::bigint FROM "_archive_page_translation_en") AS archive_count,
  CASE
    WHEN (SELECT COUNT(*)::bigint FROM "PageTranslation" WHERE locale = 'en') = 0 THEN 'OK'
    ELSE 'WARN: live en PageTranslation rows still present'
  END AS verdict;

-- =============================================================================
-- 4) Open ShopifyFieldDivergence counts by locale / fieldKey
-- =============================================================================
-- Open = resolvedAt IS NULL (matches ShopifyFieldDivergence_open_partition_idx).

SELECT
  'open_divergences_total' AS check_name,
  COUNT(*)::bigint AS open_count
FROM "ShopifyFieldDivergence"
WHERE "resolvedAt" IS NULL;

SELECT
  locale,
  "fieldKey",
  COUNT(*)::bigint AS open_count
FROM "ShopifyFieldDivergence"
WHERE "resolvedAt" IS NULL
GROUP BY locale, "fieldKey"
ORDER BY open_count DESC, locale, "fieldKey";

-- =============================================================================
-- 5) Products / variants still on PENDING-* SKUs
-- =============================================================================
SELECT
  'pending_product_skus' AS check_name,
  COUNT(*)::bigint AS pending_product_count
FROM "Product"
WHERE upper(sku) LIKE 'PENDING-%';

SELECT
  id,
  slug,
  sku,
  status,
  "shopifyProductId"
FROM "Product"
WHERE upper(sku) LIKE 'PENDING-%'
ORDER BY slug
LIMIT 100;

SELECT
  'pending_variant_skus' AS check_name,
  COUNT(*)::bigint AS pending_variant_count
FROM "ProductVariant"
WHERE upper(sku) LIKE 'PENDING-%';

SELECT
  v.id AS variant_id,
  v.sku AS variant_sku,
  p.id AS product_id,
  p.slug AS product_slug,
  p.sku AS product_sku
FROM "ProductVariant" v
JOIN "Product" p ON p.id = v."productId"
WHERE upper(v.sku) LIKE 'PENDING-%'
ORDER BY p.slug, v.sku
LIMIT 100;
