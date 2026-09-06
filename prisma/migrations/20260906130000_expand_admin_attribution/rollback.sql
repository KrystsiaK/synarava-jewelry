-- Manual rollback for 20260906130000_expand_admin_attribution.
-- Run only after rolling the application back to a version that does not use
-- these columns.
ALTER TABLE "MediaAsset" DROP COLUMN "uploadedByUsername";
ALTER TABLE "Page" DROP COLUMN "authoredByUsername";
