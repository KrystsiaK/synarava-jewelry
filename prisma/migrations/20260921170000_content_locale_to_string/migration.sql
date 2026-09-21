-- Replaces the ContentLocale enum (EN/PT only) with a plain string column
-- on every table that used it, storing lowercase registry codes ("en",
-- "pt") instead of the enum's uppercase members. This is what lets a new
-- locale (e.g. "ru") get a translation row without a schema migration.
-- Purely additive to the data: existing rows are preserved, only the
-- column type and casing change. Unique/index definitions on these
-- columns are rebuilt by Postgres automatically as part of ALTER COLUMN
-- TYPE — nothing here drops or recreates them explicitly.
ALTER TABLE "CollectionTranslation" ALTER COLUMN "locale" TYPE TEXT USING lower(locale::TEXT);
ALTER TABLE "ProductTranslation" ALTER COLUMN "locale" TYPE TEXT USING lower(locale::TEXT);
ALTER TABLE "PageTranslation" ALTER COLUMN "locale" TYPE TEXT USING lower(locale::TEXT);
ALTER TABLE "LocalizedHandleRedirect" ALTER COLUMN "locale" TYPE TEXT USING lower(locale::TEXT);
ALTER TABLE "TranslationSyncEvent" ALTER COLUMN "locale" TYPE TEXT USING lower(locale::TEXT);

DROP TYPE "ContentLocale";
