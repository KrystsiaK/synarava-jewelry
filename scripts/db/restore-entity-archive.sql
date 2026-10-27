-- Restore a Synarava collection archived by SyncEntityArchive (PR-8).
-- Usage: set :archive_id, then run inside a transaction after reviewing payload.
--
--   BEGIN;
--   -- Inspect:
--   SELECT id, "resourceType", "entityId", reason, "archivedAt", payload
--   FROM "SyncEntityArchive" WHERE id = '<archive_id>';
--
--   -- Manual restore (example — adapt JSON keys to payload shape):
--   -- 1) INSERT INTO "Collection" … from payload->'collection'
--   -- 2) INSERT translations / memberships / bindings from payload
--   -- 3) Optionally DELETE FROM "SyncEntityArchive" WHERE id = '<archive_id>';
--   COMMIT;
--
-- This script documents the restore path; operators apply the INSERT statements
-- from the archived JSON after verifying no live row with the same slug/id exists.

SELECT
  id,
  "resourceType",
  "entityId",
  reason,
  "archivedBy",
  "archivedAt",
  jsonb_pretty(payload) AS payload
FROM "SyncEntityArchive"
WHERE id = COALESCE(NULLIF(current_setting('app.archive_id', true), ''), id)
ORDER BY "archivedAt" DESC
LIMIT 20;
