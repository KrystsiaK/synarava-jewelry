-- Backfill: the "dispute-resolution" built-in page was added to
-- lib/content/built-in-pages.ts after the original built-in page seed
-- migration ran, so it never got a Page row and could not be edited in Admin.
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
  ('builtin-page-dispute-resolution', 'dispute-resolution', 'Consumer Dispute Resolution', 'STATIC_PAGE', 'PUBLISHED', 'PUBLIC', CURRENT_TIMESTAMP, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;
