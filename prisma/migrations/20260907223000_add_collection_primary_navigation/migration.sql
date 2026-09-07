-- Expand-only: mark which collections anchor the storefront's top-level
-- navigation, and seed the four navigation collections that replace the
-- hard-coded department list (lib/catalog/taxonomy.ts SHOP_DEPARTMENTS).
-- Seeding is an upsert by slug: a collection Shopify sync already created
-- at one of these slugs (via ProductCollection membership pull) is
-- promoted in place rather than duplicated.
ALTER TABLE "Collection"
ADD COLUMN "isPrimaryNav" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "navSortOrder" INTEGER NOT NULL DEFAULT 0;

INSERT INTO "Collection" ("id", "slug", "name", "isPrimaryNav", "navSortOrder", "status", "visibility", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'jewelry', 'Jewelry', true, 0, 'ACTIVE'::"CollectionStatus", 'PUBLIC'::"ContentVisibility", NOW(), NOW()),
  (gen_random_uuid()::text, 'pets', 'Pets', true, 1, 'ACTIVE'::"CollectionStatus", 'PUBLIC'::"ContentVisibility", NOW(), NOW()),
  (gen_random_uuid()::text, 'kids', 'Kids', true, 2, 'ACTIVE'::"CollectionStatus", 'PUBLIC'::"ContentVisibility", NOW(), NOW()),
  (gen_random_uuid()::text, 'jewelry-making', 'Jewelry Making', true, 3, 'ACTIVE'::"CollectionStatus", 'PUBLIC'::"ContentVisibility", NOW(), NOW())
ON CONFLICT ("slug") DO UPDATE
SET "isPrimaryNav" = true,
    "navSortOrder" = EXCLUDED."navSortOrder";
