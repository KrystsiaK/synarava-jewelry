-- New built-in page: /legal-notice. Seeded as DRAFT/PRIVATE (unlike the other
-- built-in pages) because the shipped default body still carries a "[NIF]"
-- placeholder for the seller's Portuguese Tax ID — mark it PUBLISHED in Admin
-- once the real NIF has been entered and the page reviewed. Note the route
-- itself renders regardless of this status (same as every other legal/service
-- page: an unpublished/missing Page row just falls back to the code-defined
-- default copy) — this only gates the Admin-side editorial workflow state.
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
  ('builtin-page-legal-notice', 'legal-notice', 'Legal Notice', 'STATIC_PAGE', 'DRAFT', 'PRIVATE', NULL, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;
