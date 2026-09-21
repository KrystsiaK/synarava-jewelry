-- New built-in page: /terms-and-conditions. Replaces "Public Offer Agreement"
-- (/offer) as the store's customer-facing contractual terms — /offer's own
-- Page row and route are left untouched (still admin-editable, still
-- reachable directly), just no longer linked from navigation. Content is
-- complete (no placeholder), so seeded PUBLISHED/PUBLIC like the other
-- built-ins, not DRAFT like /legal-notice.
INSERT INTO "Page" (
  "id",
  "slug",
  "title",
  "template",
  "status",
  "visibility",
  "publishedAt",
  "content",
  "createdAt",
  "updatedAt"
)
VALUES
  ('builtin-page-terms-and-conditions', 'terms-and-conditions', 'Terms & Conditions', 'STATIC_PAGE', 'PUBLISHED', 'PUBLIC', CURRENT_TIMESTAMP, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;
