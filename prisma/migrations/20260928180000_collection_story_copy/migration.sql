-- Story block copy is independent of the collection header summary.
ALTER TABLE "Collection" ADD COLUMN "storyTitle" TEXT;
ALTER TABLE "Collection" ADD COLUMN "storyBody" TEXT;
ALTER TABLE "CollectionTranslation" ADD COLUMN "storyTitle" TEXT;
ALTER TABLE "CollectionTranslation" ADD COLUMN "storyBody" TEXT;

-- Keep the current English heading editable instead of leaving it only in the page component.
UPDATE "Collection"
SET "storyTitle" = 'A world with a clear visual logic'
WHERE "storyTitle" IS NULL;

UPDATE "CollectionTranslation"
SET "storyTitle" = 'A world with a clear visual logic'
WHERE "locale" = 'en' AND "storyTitle" IS NULL;
