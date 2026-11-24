-- ContentIdea: owner RU fields + bilingual audience hook/caption; drop locale;
-- Google Calendar sync columns.
ALTER TABLE "ContentIdea" ADD COLUMN "whyRu" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ContentIdea" ADD COLUMN "hookJson" JSONB;
ALTER TABLE "ContentIdea" ADD COLUMN "captionJson" JSONB;
ALTER TABLE "ContentIdea" ADD COLUMN "calendarEventId" TEXT;
ALTER TABLE "ContentIdea" ADD COLUMN "calendarSyncedAt" TIMESTAMP(3);
ALTER TABLE "ContentIdea" ADD COLUMN "calendarSyncError" TEXT;

UPDATE "ContentIdea"
SET
  "hookJson" = CASE
    WHEN "locale" = 'pt' THEN jsonb_build_object('en', '', 'pt', "hook")
    ELSE jsonb_build_object('en', "hook", 'pt', '')
  END,
  "captionJson" = CASE
    WHEN "locale" = 'pt' THEN jsonb_build_object('en', '', 'pt', "caption")
    ELSE jsonb_build_object('en', "caption", 'pt', '')
  END;

ALTER TABLE "ContentIdea" DROP COLUMN "hook";
ALTER TABLE "ContentIdea" DROP COLUMN "caption";
ALTER TABLE "ContentIdea" DROP COLUMN "locale";

ALTER TABLE "ContentIdea" RENAME COLUMN "hookJson" TO "hook";
ALTER TABLE "ContentIdea" RENAME COLUMN "captionJson" TO "caption";

ALTER TABLE "ContentIdea" ALTER COLUMN "hook" SET NOT NULL;
ALTER TABLE "ContentIdea" ALTER COLUMN "caption" SET NOT NULL;
