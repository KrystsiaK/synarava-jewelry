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
  ('builtin-page-home', 'home', 'Home', 'HOME', 'PUBLISHED', 'PUBLIC', CURRENT_TIMESTAMP, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('builtin-page-about', 'about', 'About', 'STATIC_PAGE', 'PUBLISHED', 'PUBLIC', CURRENT_TIMESTAMP, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('builtin-page-shop', 'shop', 'Shop', 'STATIC_PAGE', 'PUBLISHED', 'PUBLIC', CURRENT_TIMESTAMP, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('builtin-page-collections', 'collections', 'Collections', 'COLLECTION_INDEX', 'PUBLISHED', 'PUBLIC', CURRENT_TIMESTAMP, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('builtin-page-journal', 'journal', 'Journal', 'STATIC_PAGE', 'PUBLISHED', 'PUBLIC', CURRENT_TIMESTAMP, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('builtin-page-care', 'care', 'Care Guide', 'STATIC_PAGE', 'PUBLISHED', 'PUBLIC', CURRENT_TIMESTAMP, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('builtin-page-shipping', 'shipping', 'Shipping', 'STATIC_PAGE', 'PUBLISHED', 'PUBLIC', CURRENT_TIMESTAMP, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('builtin-page-returns', 'returns', 'Returns', 'STATIC_PAGE', 'PUBLISHED', 'PUBLIC', CURRENT_TIMESTAMP, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('builtin-page-faq', 'faq', 'FAQ', 'STATIC_PAGE', 'PUBLISHED', 'PUBLIC', CURRENT_TIMESTAMP, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('builtin-page-offer', 'offer', 'Public Offer Agreement', 'STATIC_PAGE', 'PUBLISHED', 'PUBLIC', CURRENT_TIMESTAMP, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('builtin-page-privacy', 'privacy', 'Privacy Policy', 'STATIC_PAGE', 'PUBLISHED', 'PUBLIC', CURRENT_TIMESTAMP, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;
