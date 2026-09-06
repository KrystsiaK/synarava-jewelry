-- Expand admin attribution without removing the legacy User-backed columns yet.
-- Keeping this migration additive allows the currently running release and the
-- new release to overlap safely while Railway performs a rolling deployment.
ALTER TABLE "MediaAsset" ADD COLUMN "uploadedByUsername" TEXT;
ALTER TABLE "Page" ADD COLUMN "authoredByUsername" TEXT;
