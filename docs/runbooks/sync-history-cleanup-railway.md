# Sync-history cleanup — Railway cron (REL-010)

**Code:** [`lib/shopify/sync-history-retention.ts`](../../lib/shopify/sync-history-retention.ts) · one-shot [`scripts/db/cleanup-sync-history.mjs`](../../scripts/db/cleanup-sync-history.mjs)  
**Retention:** 90 days (`SYNC_HISTORY_RETENTION_DAYS`). Tables: resolved divergences, finished reconcile runs, `ProductSyncEvent`, `TranslationSyncEvent`, old webhook deliveries.

Owner creates this **scheduled job** in the **synarava-shop** Railway project. Agents do **not** apply Railway config and do **not** paste secret values here. Opportunistic one-batch cleanup on admin catalog check remains as a best-effort supplement — it is **not** a substitute for a scheduled drain.

---

## Why schedule it

Idle periods (no catalog Manual check) never call `cleanupSyncHistoryBestEffort`. Audit rows older than 90 days then accumulate until someone runs a check or a one-shot script. A weekly (or daily) cron drains the backlog without touching product/commerce data.

---

## What to create (owner step)

| Setting | Value |
| --- | --- |
| Project | `synarava-shop` (same Postgres as the web app) |
| Service name | `sync-history-cleanup` (suggested) |
| Source | Same GitHub repo / branch as the web service for that environment |
| Builder | Railpack (same as web) |
| **Cron schedule** | `0 4 * * 0` (weekly Sunday 04:00 UTC) — owner may choose daily `0 4 * * *` if tables grow fast |
| **Custom start command** | `node --import tsx scripts/db/cleanup-sync-history.mjs` |
| Build command | Custom Build Command `echo no-build`: install only; **do not** run `pnpm build` |
| Pre-deploy | **None** (migrations stay on the web service) |
| Restart policy | On failure only / never loop a successful exit — cron owns the next tick |
| Public networking | **Off** (no HTTP) |

Requires **Node ≥ 22.13** (repo `engines`) and `tsx` available from the workspace install (same as other Node scripts).

---

## Required variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | App Postgres (same role the web service uses for writes). **Never commit values.** |
| `NODE_AUTH_TOKEN` | GitHub Packages `read:packages` if the install step pulls `@synarava/*` (same pattern as [mission-control-collector-railway](mission-control-collector-railway.md)). |
| `RAILPACK_INSTALL_CMD` | `node scripts/pnpm-install-with-github-packages.mjs` when the install needs the Packages token. |

Optional: `NODE_ENV=production`.

---

## Behaviour

1. Script requires `DATABASE_URL`, then calls `cleanupSyncHistory({ maxBatches: 10_000 })` (full drain up to the batch cap).
2. Prints JSON stats (`divergences`, `reconcileRuns`, `productSyncEvents`, `translationSyncEvents`, `webhookDeliveries`) and disconnects Prisma.
3. Exits non-zero on failure — Railway marks the cron run failed.

**Staging first:** create the cron on staging, confirm one green run and sane stats, then mirror on production.

---

## Manual one-shot (no cron yet)

With `DATABASE_URL` already in the shell (staging local / Railway shell — never paste secrets into chat):

```bash
node --import tsx scripts/db/cleanup-sync-history.mjs
```

---

## Forbidden

- Changing retention days or DELETE logic without a code PR + review
- Running the script against production without a staging rehearsal
- Committing `DATABASE_URL` or other secrets
- Relying only on opportunistic catalog-check cleanup for idle environments
