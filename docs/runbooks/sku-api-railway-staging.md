# SKU API — Railway staging

Deploy-ready checklist for the portable SKU service on **staging only**.
Do not configure production, Shopify prod, or n8n here.

Related: [`docs/wiki/portable-sku-service.md`](../wiki/portable-sku-service.md) ·
[`docs/adr/0004-portable-sku-service-boundary.md`](../adr/0004-portable-sku-service-boundary.md) ·
[Railway IaC](https://docs.railway.com/infrastructure-as-code) ·
[Monorepo deploys](https://docs.railway.com/deployments/monorepo)

## GitHub check triage

On staging / PR #148 you may see **1 of N failed**. Separate the sources:

| Check name pattern | Source | Meaning |
| --- | --- | --- |
| `Quality Gates`, `Storefront smoke…` | **GitHub Actions** | Repo CI (`pnpm` lint/test/build/smoke) |
| `synarava-shop - synarava-shop-app` | **Railway** commit status | Web service deploy in project **synarava-shop** |
| `handsome-commitment - sku-api` | **Railway** commit status | Leftover `sku-api` service in project **handsome-commitment** (wrong project) |

### `64197e1` → `e160914` (what changed)

Commit `e160914` (`fix(sku): harden Railway staging deployment`) only touched deploy docs/IaC wiring:

- `.railway/railway.ts` — refuse apply unless `synarava-shop` + `staging`; declare GitHub `staging` source for `sku-api`
- `.railway/README.md` + this runbook — canonical CLI target is **`synarava-shop/staging`**, not `handsome-commitment`
- root `package.json` / lockfile / `pnpm-workspace.yaml` — add `railway@3.15.0` for IaC authoring

No change to `services/sku-api` runtime, Prisma schema, or web CaC content. On `e160914`: Actions **pass**, web Railway **pass**, `handsome-commitment - sku-api` still **fail**. That is **ops/redeploy drift**, not a new code regression: the wrong-project service is still connected to this repo’s `staging` branch and keeps posting a failing commit status on every push.

Do **not** “fix” it by restoring root `railway.json` or pointing that service at web CaC.

### Clear the failing check (exact)

1. **Disconnect or delete** the `sku-api` service in Railway project **handsome-commitment** (Settings → remove GitHub trigger / delete service). Until this is done, **every** `staging` push will keep failing that check.
2. In Railway project **synarava-shop** / environment **staging**, create (or move) **`sku-postgres`** + **`sku-api`** — same project as the web service so `${{sku-api.*}}` works.
3. Apply IaC from the repo (guard refuses any other project/environment):
   ```bash
   railway link --project synarava-shop --environment staging
   pnpm install --frozen-lockfile
   railway config plan
   # Continue only when the plan targets synarava-shop/staging and has no unexpected destroy.
   railway config apply
   ```
4. Or set dashboard commands on the **synarava-shop** `sku-api` (Config File **empty**):
   - Build: `pnpm --filter @synarava/sku-api prisma:generate && pnpm --filter @synarava/sku-api build`
   - Pre-deploy: `pnpm --filter @synarava/sku-api prisma:deploy`
   - Start: `pnpm --filter @synarava/sku-api start`
   - Healthcheck: `/health` (timeout ≥ 30s), Railpack, root `/`
5. Set watch paths (see below), `SKU_DATABASE_URL`, `SKU_API_CREDENTIALS`.
6. Redeploy; confirm logs are filtered sku commands. `/health` must be ready (credentials + DB) or Railway marks deploy failed.
7. Web Config File remains `/deploy/railway.synarava-web.json`.
8. Set web `SKU_API_URL=http://${{sku-api.RAILWAY_PRIVATE_DOMAIN}}:${{sku-api.PORT}}` only after sku-api is healthy **in synarava-shop/staging**.

Success signal on the next staging commit: PR checks show **no** `handsome-commitment - sku-api` row (disconnected), and either a green `synarava-shop - sku-api` Railway status or a healthy private `/health`.

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
railway link --project synarava-shop --environment staging
pnpm install --frozen-lockfile
railway config plan
# Continue only when the plan targets synarava-shop/staging and has no unexpected destroy.
railway config apply
```

Partial export `sku` owns only `sku-api` + `sku-postgres` — it does **not** manage synarava-web. The authoring file refuses to run anywhere except `synarava-shop/staging`; it also declares the GitHub `staging` source for `sku-api`. See [`.railway/README.md`](../../.railway/README.md).

If sku-api was created in a different Railway project than synarava-web, prefer moving `sku-api` + `sku-postgres` into the **synarava-shop** staging environment before relying on `${{sku-api.*}}` from the web service.

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
