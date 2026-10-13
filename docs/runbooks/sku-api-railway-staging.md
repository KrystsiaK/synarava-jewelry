# SKU API — Railway staging

Deploy-ready checklist for the portable SKU service on **staging only**.
Do not configure production, Shopify prod, or n8n here.

Related: [`docs/wiki/portable-sku-service.md`](../wiki/portable-sku-service.md) ·
[`docs/adr/0004-portable-sku-service-boundary.md`](../adr/0004-portable-sku-service-boundary.md) ·
[`services/sku-api/railway.toml`](../../services/sku-api/railway.toml)

## Services

| Railway service | Role |
| --- | --- |
| `sku-postgres` | Dedicated PostgreSQL (not Synarava CMS `DATABASE_URL`) |
| `sku-api` | Node HTTP service (`@synarava/sku-api`) |
| `synarava-web` (existing) | Calls SKU API over private network |

## `sku-api` service settings

| Setting | Value |
| --- | --- |
| Root directory | repository root (monorepo) — or set Config-as-code path to `services/sku-api/railway.toml` |
| Config path | `services/sku-api/railway.toml` |
| Watch paths | `services/sku-api/**`, `packages/sku-core/**`, `packages/sku-contract/**`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `package.json` |
| Build | `pnpm --filter @synarava/sku-api prisma:generate && pnpm --filter @synarava/sku-api build` |
| Start / pre-deploy | `pnpm --filter @synarava/sku-api prisma:deploy && pnpm --filter @synarava/sku-api start` |
| Healthcheck path | `/health` |
| Healthcheck timeout | 30s |
| Networking | **Private** network only (no public domain for staging v1) |

Watch paths must **not** include the whole app tree so storefront-only changes do not redeploy `sku-api`.

## Environment — `sku-api`

| Variable | Required | Notes |
| --- | --- | --- |
| `SKU_DATABASE_URL` | yes | Reference `${{sku-postgres.DATABASE_URL}}` (or your Postgres service name) |
| `SKU_API_CREDENTIALS` | yes | `workspace:saltHex:scryptHashHex` — **hashed**, never plaintext |
| `PORT` | Railway sets | Listen uses `PORT` then `SKU_API_PORT` |
| `SKU_BOOTSTRAP` | optional | Default on: idempotent `synarava-shop` workspace + published profile v1. Set `0` only for empty DB experiments |
| `SKU_API_DEV_TOKEN` | **no** on staging | Local/dev only |
| `SKU_SEED_EXAMPLE` | **removed** | Do not set; bootstrap replaced it |

Generate credentials (prints hash + plaintext separately):

```bash
pnpm --filter @synarava/sku-api credentials:generate -- synarava-shop
```

1. Copy the `SKU_API_CREDENTIALS` line into the **sku-api** Railway variables.
2. Copy the plaintext `SKU_API_TOKEN` into **synarava-web** only (once). Never put plaintext into `SKU_API_CREDENTIALS` or git.

## Environment — `synarava-web` (staging)

Server-only (never `NEXT_PUBLIC_*`):

| Variable | Value |
| --- | --- |
| `SKU_API_URL` | Exact private form (no trailing slash): `http://${{sku-api.RAILWAY_PRIVATE_DOMAIN}}:${{sku-api.PORT}}` |
| `SKU_API_TOKEN` | plaintext from `credentials:generate` |
| `SKU_API_WORKSPACE` | `synarava-shop` (optional; default) |

Paste the `SKU_API_URL` template above into the **synarava-web** staging variables as written (Railway resolves the `${{sku-api.*}}` references). Do not use a public `*.up.railway.app` URL for staging v1.

## Healthcheck

`GET /health` returns:

- `200` when credentials are configured **and** (Postgres mode) DB responds to `SELECT 1`
- `503` otherwise
- Body includes `store: "postgres" | "memory"`

Staging must show `"store":"postgres"`. Memory mode means `SKU_DATABASE_URL` was not set.

## Bootstrap

On process start (unless `SKU_BOOTSTRAP=0`):

1. Ensure workspace `synarava-shop`
2. If no published profile → publish draft v1 (or create draft then publish)
3. Safe to re-run across deploys

Canonical 49-SKU legacy import is a separate ops step (fixture exists; full import when export is provided) — not part of automatic bootstrap.

## Verify after deploy

```bash
# From a shell that can reach the private sku-api URL (or temporary one-off public for smoke):
curl -sS "$SKU_API_URL/health"
# expect: {"ok":true,"service":"@synarava/sku-api","ready":true,"store":"postgres"}
```

In Synarava Admin → Shared → SKU policy: staging-gate alert should clear once `SKU_API_URL` + `SKU_API_TOKEN` are set; draft/publish and assignment list should load.

## Local without Postgres

Omit `SKU_DATABASE_URL` → in-memory store (unit tests / `pnpm --filter @synarava/sku-api dev`).
With Postgres: set `SKU_DATABASE_URL` and run `pnpm --filter @synarava/sku-api test:integration`.
