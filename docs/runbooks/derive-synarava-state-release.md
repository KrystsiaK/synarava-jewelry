# Release: derive Synarava commerce state (ADR-0009)

Cutover migration: `prisma/migrations/20261026160000_derive_synarava_extras_drop_working_snapshot`  
Verify gate: `scripts/db/verify-derived-window.mjs`  
Archive restore SQL: `scripts/db/rollback-working-snapshot.sql`

Do **not** edit the applied migration SQL. Ops changes go in the verify script, rollback SQL comments, and this runbook.

## Preconditions

1. Verified database backup / PITR restore point taken **immediately before** the migration.
2. App, background workers, and Shopify webhooks **stopped** (no Pull / Apply / Save / webhook traffic). The migration copies archives with CTAS **before** the exclusive `ALTER` that drops `workingSnapshot`; writers during that window can drift.
3. Staging already green on the same commit (verify script exit 0).

## Production pre-checks (read-only)

```bash
# Confirm migration not yet applied (or archives still present after apply).
pnpm prisma migrate status

# After migrate deploy on a quiesced DB — both archives required:
DATABASE_URL="$PROD_DATABASE_URL" node --import tsx scripts/db/verify-derived-window.mjs
# Expect JSON status "ok", exit 0.
# Missing either archive table → exit 1 (no silent skip).
```

Coverage rules enforced by the verify script:

- Both `_archive_product_working_snapshot` and `_archive_collection_working_snapshot` exist.
- Archive row count equals live `Product` / `Collection` count.
- Every archive `workingSnapshot` is non-null.
- Every live row has an archive row.
- `canonicalize(derive(columns+extras))` ≡ canonicalize(archive) — script prints **IDs and paths only**, never field values.

## Apply

1. Stop app / workers / webhooks.
2. `pnpm prisma:deploy` (Railway pre-deploy, or manual against the quiesced DB).
3. Re-run verify (post-check below).
4. Start app / workers; re-enable webhooks.

## Production post-checks

```bash
DATABASE_URL="$PROD_DATABASE_URL" node --import tsx scripts/db/verify-derived-window.mjs
# status "ok", differing: 0

# Smoke: admin conflict check / top-bar counts; one product Pull does not rewrite Synarava content.
```

## Rollback

| Window | Action |
|--------|--------|
| Before any post-cutover writes | `scripts/db/rollback-working-snapshot.sql` restores **pre-cutover** snapshots from archives. Also roll back application code that assumes `extras` / no `workingSnapshot`. |
| After traffic resumed | **Primary rollback = restore the verified pre-migration DB backup.** Archive SQL is not authoritative once Pull/Apply/Save have changed columns or `extras`. |

Escape hatch for local sandboxes only: `VERIFY_DERIVED_WINDOW_ALLOW_MISSING_ARCHIVES=1` skips when **both** archives are absent. Never set in production gates.
