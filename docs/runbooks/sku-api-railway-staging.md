# SKU API — Railway staging

Deploy-ready checklist for the portable SKU service on **staging only**.
Do not configure production, Shopify prod, or n8n here.

Related: [`docs/wiki/portable-sku-service.md`](../wiki/portable-sku-service.md) ·
[`docs/adr/0004-portable-sku-service-boundary.md`](../adr/0004-portable-sku-service-boundary.md) ·
[Railway IaC](https://docs.railway.com/infrastructure-as-code) ·
[Monorepo deploys](https://docs.railway.com/deployments/monorepo)

## Why not root `railway.json` / `railway.toml`

| Mechanism | Status | Notes |
| --- | --- | --- |
| Config as Code (`railway.json` / `railway.toml`) | **Deprecated** | Overrides dashboard; new services cannot opt in; hard cutoff **2026-12-01** |
| Infrastructure as Code (`.railway/railway.ts`) | **GA** | Preferred for `sku-api` |

A root `/railway.json` made the new `sku-api` service inherit Next.js `pnpm build` / `pnpm start`. That file was moved to **`/deploy/railway.synarava-web.json`** for the **web** service only. `services/sku-api/railway.toml` (invalid `NIXPACKS` builder) was removed.

## Services

| Railway service | Role | Config source |
| --- | --- | --- |
| `sku-postgres` | Dedicated PostgreSQL (not Synarava CMS `DATABASE_URL`) | IaC partial `sku` |
| `sku-api` | Node HTTP (`@synarava/sku-api`) | IaC partial `sku` — [`.railway/railway.ts`](../../.railway/railway.ts) |
| synarava-web (existing) | Storefront + admin; private client of SKU API | Legacy CaC: [`deploy/railway.synarava-web.json`](../../deploy/railway.synarava-web.json) |

## One-time dashboard fix (do this before redeploy)

### A. synarava-web — keep storefront working

1. Open the **web** service → Settings.
2. Set **Config File** to exactly: `/deploy/railway.synarava-web.json`
3. Confirm effective plan stays:
   - Builder: `RAILPACK`
   - Build: `pnpm build`
   - Pre-deploy: `pnpm prisma:deploy`
   - Start: `pnpm start`
   - Health: `/api/health`

Without step 2, web loses CaC after the root file move.

### B. sku-api — stop Next.js commands

**Preferred:** apply IaC (section below).

**Or set dashboard Service Settings** (Config File **empty** / none — do not point at web CaC):

| Setting | Exact value |
| --- | --- |
| Root directory | `/` (monorepo / pnpm workspace root) |
| Builder | Railpack (default) — **not** NIXPACKS |
| Build command | `pnpm --filter @synarava/sku-api prisma:generate && pnpm --filter @synarava/sku-api build` |
| Pre-deploy command | `pnpm --filter @synarava/sku-api prisma:deploy` |
| Start command | `pnpm --filter @synarava/sku-api start` |
| Healthcheck path | `/health` |
| Healthcheck timeout | `30` |
| Networking | **Private** only (no public domain for staging v1) |
| Watch paths | see below |

### Watch paths (`sku-api`)

```
/services/sku-api/**
/packages/sku-core/**
/packages/sku-contract/**
/pnpm-lock.yaml
/pnpm-workspace.yaml
/package.json
/.railway/**
```

Do **not** watch the whole app tree — storefront-only changes must not redeploy `sku-api`.

## sku-api deployment plan (canonical)

```text
build:      pnpm --filter @synarava/sku-api prisma:generate && pnpm --filter @synarava/sku-api build
pre-deploy: pnpm --filter @synarava/sku-api prisma:deploy
start:      pnpm --filter @synarava/sku-api start
health:     /health
```

Encoded in [`.railway/railway.ts`](../../.railway/railway.ts) (`preDeploy` / `start` / `healthcheck`).

## Apply Infrastructure as Code (staging)

```bash
railway login
railway link          # this repo’s project + staging environment
pnpm add -D railway   # provides railway/iac for the authoring file
pnpm exec railway config plan
pnpm exec railway config apply
```

Partial export `sku` owns only `sku-api` + `sku-postgres` — it does **not** manage synarava-web. See [`.railway/README.md`](../../.railway/README.md).

## Environment — `sku-api`

| Variable | Required | Notes |
| --- | --- | --- |
| `SKU_DATABASE_URL` | yes | IaC sets `${{sku-postgres.DATABASE_URL}}` (or dashboard reference) |
| `SKU_API_CREDENTIALS` | yes | `workspace:saltHex:scryptHashHex` — **hashed**, never plaintext |
| `PORT` | Railway sets | Listen uses `PORT` then `SKU_API_PORT` |
| `SKU_BOOTSTRAP` | optional | Default on: idempotent `synarava-shop` + published profile v1. Set `0` only for empty DB experiments |
| `SKU_API_DEV_TOKEN` | **no** on staging | Local/dev only |
| `SKU_SEED_EXAMPLE` | **removed** | Do not set |

Generate credentials (prints hash + plaintext separately):

```bash
node services/sku-api/scripts/generate-credentials.mjs synarava-shop
```

(`pnpm --filter … credentials:generate -- synarava-shop` passes `--` as the workspace arg — do not use that form.)

1. Copy the `SKU_API_CREDENTIALS` line into **sku-api** Railway variables.
2. Copy the plaintext `SKU_API_TOKEN` into **synarava-web** only (once). Never put plaintext into `SKU_API_CREDENTIALS` or git.

## Environment — `synarava-web` (staging)

Server-only (never `NEXT_PUBLIC_*`):

| Variable | Value |
| --- | --- |
| `SKU_API_URL` | Exact private form (no trailing slash): `http://${{sku-api.RAILWAY_PRIVATE_DOMAIN}}:${{sku-api.PORT}}` |
| `SKU_API_TOKEN` | plaintext from credentials script |
| `SKU_API_WORKSPACE` | `synarava-shop` (optional; default) |

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

## Verify after deploy

```bash
curl -sS "$SKU_API_URL/health"
# expect: {"ok":true,"service":"@synarava/sku-api","ready":true,"store":"postgres"}
```

Confirm the **sku-api** deploy log shows the filtered build/start above — not root `pnpm build` / `pnpm start`.

In Synarava Admin → Shared → SKU policy: staging-gate alert should clear once `SKU_API_URL` + `SKU_API_TOKEN` are set.

## Local without Postgres

Omit `SKU_DATABASE_URL` → in-memory store (unit tests / `pnpm --filter @synarava/sku-api dev`).
With Postgres: set `SKU_DATABASE_URL` and run `pnpm --filter @synarava/sku-api test:integration`.
