-- ADR-0009: archive workingSnapshot, backfill Product/Collection.extras (orphan keys only), drop workingSnapshot.
BEGIN;

CREATE TABLE "_archive_product_working_snapshot" AS
SELECT id, "workingSnapshot", "shopifySnapshot"
FROM "Product";

CREATE TABLE "_archive_collection_working_snapshot" AS
SELECT id, "workingSnapshot", "shopifySnapshot"
FROM "Collection";

DO $$
DECLARE
  product_live integer;
  product_archive integer;
  collection_live integer;
  collection_archive integer;
BEGIN
  SELECT COUNT(*) INTO product_live FROM "Product";
  SELECT COUNT(*) INTO product_archive FROM "_archive_product_working_snapshot";
  IF product_archive <> product_live THEN
    RAISE EXCEPTION
      'Product archive count mismatch: archive=% live=%',
      product_archive, product_live;
  END IF;

  SELECT COUNT(*) INTO collection_live FROM "Collection";
  SELECT COUNT(*) INTO collection_archive FROM "_archive_collection_working_snapshot";
  IF collection_archive <> collection_live THEN
    RAISE EXCEPTION
      'Collection archive count mismatch: archive=% live=%',
      collection_archive, collection_live;
  END IF;
END $$;

ALTER TABLE "Product" ADD COLUMN "extras" JSONB;
ALTER TABLE "Collection" ADD COLUMN "extras" JSONB;

-- Backfill Product.extras from workingSnapshot — only no-other-home orphan keys
-- (media, publications, metafields, metafieldTranslations, options, category).
-- variantInventory (HS / country of origin) is filled in a follow-up loop below.
UPDATE "Product"
SET extras = jsonb_strip_nulls(jsonb_build_object(
  'media', "workingSnapshot"->'media',
  'publications', "workingSnapshot"->'publications',
  'metafields', "workingSnapshot"->'metafields',
  'metafieldTranslations', "workingSnapshot"->'metafieldTranslations',
  'options', "workingSnapshot"->'options',
  'category', "workingSnapshot"->'category'
))
WHERE "workingSnapshot" IS NOT NULL;

-- Extract variantInventory orphans (countryCodeOfOrigin / harmonizedSystemCode)
-- keyed by variant id, else sku:<sku>. Leaves null when variants lack those fields.
DO $$
DECLARE
  r RECORD;
  variant jsonb;
  inv jsonb;
  key text;
  patch jsonb;
  inventory jsonb;
BEGIN
  FOR r IN
    SELECT id, "workingSnapshot"
    FROM "Product"
    WHERE "workingSnapshot" IS NOT NULL
      AND jsonb_typeof("workingSnapshot"->'variants') = 'array'
  LOOP
    inventory := '{}'::jsonb;
    FOR variant IN SELECT * FROM jsonb_array_elements(r."workingSnapshot"->'variants')
    LOOP
      inv := variant->'inventoryItem';
      IF inv IS NULL OR jsonb_typeof(inv) <> 'object' THEN
        CONTINUE;
      END IF;
      IF NOT (inv ? 'countryCodeOfOrigin' OR inv ? 'harmonizedSystemCode') THEN
        CONTINUE;
      END IF;

      IF jsonb_typeof(variant->'id') = 'string' AND length(trim(both FROM variant->>'id')) > 0 THEN
        key := variant->>'id';
      ELSIF jsonb_typeof(variant->'sku') = 'string' AND length(trim(both FROM variant->>'sku')) > 0 THEN
        key := 'sku:' || trim(both FROM variant->>'sku');
      ELSE
        CONTINUE;
      END IF;

      patch := '{}'::jsonb;
      IF inv ? 'countryCodeOfOrigin' THEN
        patch := patch || jsonb_build_object('countryCodeOfOrigin', inv->'countryCodeOfOrigin');
      END IF;
      IF inv ? 'harmonizedSystemCode' THEN
        patch := patch || jsonb_build_object('harmonizedSystemCode', inv->'harmonizedSystemCode');
      END IF;
      inventory := inventory || jsonb_build_object(key, patch);
    END LOOP;

    IF inventory <> '{}'::jsonb THEN
      UPDATE "Product"
      SET extras = COALESCE(extras, '{}'::jsonb) || jsonb_build_object('variantInventory', inventory)
      WHERE id = r.id;
    END IF;
  END LOOP;
END $$;

-- Normalize empty objects to NULL (no orphan keys).
UPDATE "Product"
SET extras = NULL
WHERE extras IS NOT NULL AND extras = '{}'::jsonb;

-- Collection.extras usually empty in V1; leave NULL (no orphan backfill).

ALTER TABLE "Product" DROP COLUMN "workingSnapshot";
ALTER TABLE "Collection" DROP COLUMN "workingSnapshot";

COMMIT;
