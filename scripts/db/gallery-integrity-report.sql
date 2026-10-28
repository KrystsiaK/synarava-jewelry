-- Read-only diagnostic: product gallery integrity (extras.media vs shopifySnapshot.media).
-- NO repair writes — owner repairs via Take Shopify / gallery ops.
-- Linked products only (shopifyProductId IS NOT NULL).

-- 1) extras.media has fewer frames than shopifySnapshot.media
SELECT
  p.id AS product_id,
  p.slug,
  p."shopifyProductId" AS shopify_product_id,
  COALESCE(jsonb_array_length(p.extras->'media'), 0) AS extras_media_count,
  COALESCE(jsonb_array_length(p."shopifySnapshot"->'media'), 0) AS snapshot_media_count
FROM "Product" p
WHERE p."shopifyProductId" IS NOT NULL
  AND p."shopifySnapshot" IS NOT NULL
  AND jsonb_typeof(p."shopifySnapshot"->'media') = 'array'
  AND (
    p.extras IS NULL
    OR p.extras->'media' IS NULL
    OR jsonb_typeof(p.extras->'media') <> 'array'
    OR COALESCE(jsonb_array_length(p.extras->'media'), 0)
      < jsonb_array_length(p."shopifySnapshot"->'media')
  )
ORDER BY p.slug;

-- 2) Duplicate frame ids inside extras.media
SELECT
  p.id AS product_id,
  p.slug,
  media_frame.id AS duplicate_frame_id,
  COUNT(*) AS occurrences
FROM "Product" p
CROSS JOIN LATERAL jsonb_array_elements(
  CASE
    WHEN p.extras IS NOT NULL AND jsonb_typeof(p.extras->'media') = 'array'
      THEN p.extras->'media'
    ELSE '[]'::jsonb
  END
) AS elem(node)
CROSS JOIN LATERAL (SELECT elem.node->>'id' AS id) AS media_frame
WHERE p."shopifyProductId" IS NOT NULL
  AND media_frame.id IS NOT NULL
  AND media_frame.id <> ''
GROUP BY p.id, p.slug, media_frame.id
HAVING COUNT(*) > 1
ORDER BY p.slug, media_frame.id;

-- 3) `local:` frames carrying a Shopify gid (should never happen)
--    Staging ids must be `local:<assetId>` only — never `local:gid://…` or a sibling gid field.
SELECT
  p.id AS product_id,
  p.slug,
  elem.node->>'id' AS frame_id
FROM "Product" p
CROSS JOIN LATERAL jsonb_array_elements(
  CASE
    WHEN p.extras IS NOT NULL AND jsonb_typeof(p.extras->'media') = 'array'
      THEN p.extras->'media'
    ELSE '[]'::jsonb
  END
) AS elem(node)
WHERE p."shopifyProductId" IS NOT NULL
  AND elem.node->>'id' LIKE 'local:%'
  AND (
    elem.node->>'id' LIKE 'local:gid://%'
    OR COALESCE(elem.node->>'shopifyId', elem.node->>'shopifyMediaId', elem.node->>'mediaImageId', '')
      LIKE 'gid://shopify/%'
  )
ORDER BY p.slug;
