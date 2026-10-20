# Production database incident recovery

**Status:** procedure proven on 2026-10-19/20 (production wipe). Update after every real use.
**Context:** a Prisma shadow-database command was pointed at the production Postgres and wiped it. See [production-database-safety-and-recovery](../proposals/production-database-safety-and-recovery.md) for the incident plan and the execution log.

This is the order that worked. Do not skip steps and do not run commands from memory against production.

## What lives where (decides how much is recoverable)

| Data | Source of truth | Recovery |
|---|---|---|
| Catalog (products, variants, SKU, collections, media links) | Shopify | Full product sync from Shopify (admin pull / reconcile) |
| Media files | Railway bucket (S3) | Not touched by a DB wipe; re-link rows from the product sync |
| Translations: `custom.*` metafields | Shopify | Come back with the product sync |
| Translations: titles/bodies, page copy, `SiteSetting`, nav, SEO | Our DB only (editorial) | Backup, or re-enter. Shopify does not hold them |
| `$app:` metaobjects (e.g. `product_detail_copy`) | Shopify, readable only by the app that owns them (Synarava Sync) | Not readable with any other app's credentials |
| Migration history (`_prisma_migrations`) | Our DB | Rebuild with the baseline below |

## Checklist

1. **Freeze.** Stop every agent and script that can touch the database. No `migrate`, `db push`, seed or reset of any kind. Remove production write URLs from agent environments (Cursor secrets, shells).
2. **Back up the current state first** (Railway: production Postgres > Backups > manual backup), even if it is the broken state. PITR enabled after an incident does not restore anything from before it.
3. **Assess read-only.** In Railway Query: row counts for `Product`, `ProductVariant`, `Collection`, `ProductTranslation`, `SiteSetting`, `Page`, and check whether `_prisma_migrations` exists. Compare with a backup/PITR restored into a NEW service; never restore over the live database.
4. **Rebuild the catalog from Shopify** with the project's product sync (one product first, check the result, then all). Confirm counts against Shopify admin.
5. **Re-create the Shopify store binding.** Pushes and syncs fail with "Run the catalog conflict check once to bind this catalog before syncing" because the `shopify.store_binding` row of `SiteSetting` is gone (`lib/shopify/store-binding.ts`). Fix: Admin > Products > run the catalog conflict check (the refresh button next to "N changes to review"). Check that the reported store is the right one: pushes go to it.
6. **Translations page** (Admin > Translations, "Shopify sync"): press Check now. For fields that differ: text only on our side > Keep Synarava; text only in Shopify > Use Shopify. When unsure, prefer the choice that changes only our side. Empty on both sides is not listed.
7. **Rebuild the migration history** (baseline, below), then enable the Railway pre-deploy step.
8. **Re-issue narrow credentials** (below) and rotate anything that was exposed.
9. **Verify:** storefront and admin load, a product edit pushes to Shopify, `/admin/mission-control` shows live nodes, the collector writes rows, the last deploy is green.

## Baseline of the migration history

Use when `_prisma_migrations` is missing but the schema is intact. `migrate resolve --applied` only inserts history rows; it does not change the schema. Prisma refuses `migrate deploy` on a database that has a schema but no history (P3005), which blocks every deploy until this is done.

Preconditions:
- A fresh manual backup exists.
- The schema matches the migrations. Check read-only: replay all migrations into a throwaway local database and diff it against production with a read-only role. The known harmless leftovers were 7 legacy enums and 2 column defaults.
- The procedure was rehearsed on a throwaway local database (state: schema without history, newest migration missing).

Run from your own terminal, in a clean checkout of `main` (the production URL is typed hidden and is never pasted into chat or into an agent):

```bash
git fetch -q origin main && git worktree add --detach /tmp/prod-baseline origin/main
export CHECKPOINT_DISABLE=1 PRISMA_HIDE_UPDATE_MESSAGE=1
P=<repo>/node_modules/.bin/prisma
S=/tmp/prod-baseline/prisma/schema.prisma
read -rs "DATABASE_URL?Paste production DATABASE_PUBLIC_URL (hidden): "
export DATABASE_URL
$P migrate status --schema=$S        # confirm host/database, expect N migrations, none applied
# mark every migration that already exists in the database as applied; leave the pending one(s) out
for m in $(ls /tmp/prod-baseline/prisma/migrations | grep -v migration_lock | grep -v <pending_migration_name>); do
  $P migrate resolve --applied "$m" --schema=$S || break
done
$P migrate status --schema=$S        # expect exactly the pending migration
$P migrate deploy --schema=$S        # applies only the pending migration
$P migrate status --schema=$S        # expect "Database schema is up to date!"
unset DATABASE_URL; git worktree remove --force /tmp/prod-baseline
```

Notes: `export` must always carry the variable name (a bare `export` prints the whole environment, including secrets). Use `DATABASE_PUBLIC_URL` (a `*.proxy.rlwy.net` host); the internal host is not reachable from a laptop.

Then Railway > production service `synarava-shop-app` > Settings > Deploy > Pre-deploy command: `pnpm prisma:deploy`. The legacy `deploy/railway.synarava-web.json` is not applied automatically; the setting must exist in the service. After the baseline the step is a no-op ("No pending migrations") and applies future migrations by itself. Repeat the baseline for staging separately; its database has its own history.

## Narrow credentials

| Role / key | Purpose | Rights |
|---|---|---|
| `agent_ro` (Postgres) | Cursor/Codex agents reading production | Login, `default_transaction_read_only`, `statement_timeout 15s`, SELECT on public tables except `AdminSession`, `ShopifyCustomerSession`, `RateLimitBucket`; no CREATE on schema `public` |
| `mc_collector` (Postgres) | Mission Control collector worker | INSERT/UPDATE on `ServiceNodeStatus`, `ServiceFlowStatus`; SELECT on those plus `ShopifyWebhookDelivery`, `ProductSyncEvent` |
| Shopify app `Synarava Agent RO` | Agents reading Shopify | Read scopes only |
| S3 keys | App only | Removed from agent environments |

The agent database variable is named `PROD_RO_DATABASE_URL`, never `DATABASE_URL`, so Prisma and scripts never pick it up by accident. The collector's `DATABASE_URL` is set only on its Railway service.

Railway's Query console appends `LIMIT` to any statement containing the word SELECT, which breaks `GRANT SELECT`. Split the keyword inside a `DO` block, one statement at a time:

```sql
DO $$ BEGIN EXECUTE 'GRANT SEL' || 'ECT ON "ServiceNodeStatus", "ServiceFlowStatus" TO mc_collector'; END $$;
```

## Guards in the repo

- `scripts/db-guard.mjs`: `pnpm prisma:migrate` and `pnpm prisma:push` run only when every database URL is localhost.
- `.codex/hooks/block-dangerous-prisma.mjs`: blocks raw `prisma migrate dev/reset`, `db push/execute` and any `--shadow-database-url` for Claude Code and Codex (and a Cursor adapter). Cursor cloud agents do not invoke project hooks, so the read-only credentials are the protection there.
- Migrations are generated without a database: diff two schema files with `prisma migrate diff --from-schema-datamodel ... --to-schema-datamodel ... --script`. See "Database rules for agents" in [mission-control-hub-plan](mission-control-hub-plan.md).

## Lessons

- Never point a shadow database at anything but a throwaway local database.
- Agents get read-only credentials only; production write URLs live only in the owner's terminal and in the Railway service that needs them.
- A restore or PITR enabled after the fact is not a backup of the past: take manual backups before risky work and test a restore.
- After any restore, expect these to be missing: the store binding, the migration history and editorial content that Shopify does not hold.
