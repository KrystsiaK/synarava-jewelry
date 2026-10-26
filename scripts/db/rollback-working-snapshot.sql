-- Rollback for prisma/migrations/20261026160000_derive_synarava_extras_drop_working_snapshot
-- Restores Product/Collection.workingSnapshot from archive tables created by that migration.
-- Run manually against the target DB after confirming archives exist.
-- Does NOT drop Product.extras / Collection.extras (safe to leave; unused after restore until
-- code is also rolled back). Drop extras only if you are fully reverting the ADR-0009 cutover.

-- Restore Product.workingSnapshot
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "workingSnapshot" JSONB;

UPDATE "Product" AS p
SET "workingSnapshot" = a."workingSnapshot"
FROM "_archive_product_working_snapshot" AS a
WHERE p.id = a.id;

-- Restore Collection.workingSnapshot
ALTER TABLE "Collection" ADD COLUMN IF NOT EXISTS "workingSnapshot" JSONB;

UPDATE "Collection" AS c
SET "workingSnapshot" = a."workingSnapshot"
FROM "_archive_collection_working_snapshot" AS a
WHERE c.id = a.id;

-- Optional: after a successful restore + verification window, drop archives.
-- DROP TABLE IF EXISTS "_archive_product_working_snapshot";
-- DROP TABLE IF EXISTS "_archive_collection_working_snapshot";

-- Optional (full ADR-0009 revert only — also roll back application code first):
-- ALTER TABLE "Product" DROP COLUMN IF EXISTS "extras";
-- ALTER TABLE "Collection" DROP COLUMN IF EXISTS "extras";
