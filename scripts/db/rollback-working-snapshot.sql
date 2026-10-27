-- Rollback helper for prisma/migrations/20261026160000_derive_synarava_extras_drop_working_snapshot
--
-- What this does
--   Restores Product/Collection.workingSnapshot columns from the pre-cutover
--   archive tables created by that migration:
--     _archive_product_working_snapshot
--     _archive_collection_working_snapshot
--
-- Safety window
--   Safe ONLY before post-cutover writes (Pull / Apply / admin Save) have
--   mutated columns or extras after the migration. After traffic resumes,
--   archive rows are stale relative to live commerce state — do NOT use this
--   script as the primary rollback. Restore a verified DB backup taken
--   immediately before the migration instead.
--
-- Production migration posture
--   Stop the app, workers, and Shopify webhooks before applying the cutover
--   migration. The migration's CTAS archive copy runs before the exclusive
--   ALTER that drops workingSnapshot; quiescing writers avoids mid-copy drift.
--
-- Does NOT drop Product.extras / Collection.extras (safe to leave; unused after
-- restore until application code is also rolled back). Drop extras only if you
-- are fully reverting the ADR-0009 cutover and have rolled back app code first.

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
