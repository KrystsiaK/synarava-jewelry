-- PR-8: additive archive table for destructive sync resolutions.
-- CREATE TABLE only — no drops/alters of existing tables. Idempotent.

CREATE TABLE IF NOT EXISTS "SyncEntityArchive" (
    "id" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "archivedBy" TEXT,
    "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncEntityArchive_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SyncEntityArchive_resourceType_entityId_idx"
  ON "SyncEntityArchive"("resourceType", "entityId");

CREATE INDEX IF NOT EXISTS "SyncEntityArchive_archivedAt_idx"
  ON "SyncEntityArchive"("archivedAt");
