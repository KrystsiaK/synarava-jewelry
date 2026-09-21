-- Russian is now enabled and published in Shopify Markets. Registers it in
-- the registry with routeSegment "ru" (matches the code, no conflict with
-- en/pt). isPublished/shopifyUpdatedAt get refreshed by the next
-- "Check Shopify" sync, same as any other row.
INSERT INTO "StorefrontLocale"
  ("id", "code", "routeSegment", "shopifyLocale", "intlLocale", "name", "nativeName", "isDefault", "isPublished", "sortOrder", "updatedAt")
VALUES
  ('storefront-locale-ru', 'ru', 'ru', 'ru', 'ru', 'Russian', 'Русский', false, false, 2, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;
