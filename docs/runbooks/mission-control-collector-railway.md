# Mission Control collector — Railway cron (Stage 5)

**Plan:** [mission-control-hub-plan.md](mission-control-hub-plan.md) § Stage 5  
**Progress:** [mission-control-progress.md](mission-control-progress.md)

Owner creates this service in the **synarava-shop** Railway project. Agents do **not** apply Railway config and do **not** paste secret values here.

The collector is **observe + notify only**: one process, one run per cron tick, then exit. It never restarts or repairs anything.

---

## What to create

| Setting | Value |
| --- | --- |
| Project | `synarava-shop` (same Postgres as the web app) |
| Service name | `mission-control-collector` (suggested) |
| Source | Same GitHub repo / branch as staging web (or production when promoted) |
| Builder | Railpack (same as web) |
| **Cron schedule** | e.g. `*/5 * * * *` (every 5 minutes) — owner chooses |
| **Custom start command** | `pnpm mission-control:collect` |
| Build command | Prefer install-only: leave default install; **do not** run `pnpm build` (Next.js) for this service |
| Pre-deploy | **None** (migrations stay on the web service `preDeployCommand`) |
| Restart policy | On failure only / never loop a successful exit — cron owns the next tick |
| Overlap | Keep schedule longer than a typical run so ticks do not overlap (read-then-alert assumes one invocation at a time) |
| Public networking | **Off** (no HTTP) |

Start command expands to:

```bash
node --experimental-strip-types --import ./services/mission-control-collector/register.mjs ./services/mission-control-collector/main.ts
```

Requires **Node ≥ 22.13** (repo `engines`).

---

## Required variables

Set on the collector service (reference the web/Postgres vars where possible). **Never commit values.**

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Same Postgres as the app (`ServiceNodeStatus` / `ServiceFlowStatus` upserts). Use a Railway reference, e.g. `${{Postgres.DATABASE_URL}}`. |
| `APP_URL` | Public site origin (no trailing slash). Used for `site-health` ping and the Telegram link to `/admin/mission-control`. |
| `TELEGRAM_BOT_TOKEN` | Bot token for alerts. **Runtime only — never log.** |
| `TELEGRAM_CHAT_ID` | Destination chat/channel id. **Runtime only — never log.** |
| `NODE_AUTH_TOKEN` | Build-time only if install needs GitHub Packages for `@synarava/*` (same as web). See [deploy.md](deploy.md). |

Optional: `NODE_ENV=production`.

If `TELEGRAM_BOT_TOKEN` or `TELEGRAM_CHAT_ID` is missing, the run still upserts statuses and **skips** Telegram (no crash).

---

## Behaviour (for operators)

1. Probes live providers: `site-health`, `shopify-sync`, `orders`.
2. Upserts `ServiceNodeStatus` and derives `ServiceFlowStatus` from WiringConfig sources.
3. Telegram **only** when a node’s level **changes into** `warn` or `down` (reads previous level first — no same-level spam).
4. Message: node name, level, short static hint, link `{APP_URL}/admin/mission-control`.
5. Logs (not Telegram) WiringConfig nodes with **no provider** and **not** marked placeholder (`db`, `products`, `sentry`).
6. Process exits after one run.

---

## Forbidden

- Giving the worker rights to fix/restart services
- New tables or new npm dependencies for this stage
- Putting bot token / chat id in logs, docs, or git
