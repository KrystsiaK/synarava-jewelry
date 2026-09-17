-- Journal feature removed: the /journal route, its admin posts UI, and the
-- Post/PostTranslation tables are gone from the app. Confirmed empty of real
-- content before this migration was authored.

DELETE FROM "Page" WHERE "slug" = 'journal';

DROP TABLE IF EXISTS "PostTranslation";
DROP TABLE IF EXISTS "Post";
