# Railway Infrastructure as Code — portable SKU platform

Canonical docs: [Infrastructure as Code](https://docs.railway.com/infrastructure-as-code) · [Monorepo deploys](https://docs.railway.com/deployments/monorepo) · [n8n on Railway](https://docs.railway.com/guides/n8n)

| File | Role |
| --- | --- |
| `.railway/railway.ts` | Named partial `sku` — **staging** + **production** branches |
| `deploy/railway.synarava-web.json` | Legacy CaC for **synarava-web** in project **synarava-shop** only |
| `deploy/n8n/sku-catalog-audit.workflow.json` | Catalog-audit workflow (import into **staging** n8n) |
| `deploy/n8n/sku-catalog-audit.workflow.production.json` | Catalog-audit workflow artifact for **production** n8n (manual import only) |

## Architecture

- **Railway project:** `portable-sku-platform` (ID `6d7d5885-43eb-4283-b4a4-e552fc6dba7b`).
- **IaC guards:** immutable **project ID**; staging by name; production by name **and** environment ID `d8cb7dd8-5c26-4255-a8c5-7795f1993de6`; refuses `synarava-shop`.
- **Staging:** adopt `sku-api` / `sku-postgres`; manage staging `n8n` + `n8n-postgres` + `n8n-data-v2`.
- **Production (Stage 6):** adopt `sku-platform-n8n` / `sku-platform-n8n-postgres` / `sku-platform-n8n-volume` (+ existing `postgres-volume`); **create only** `sku-api` + `sku-postgres`. Image pin `PROD_N8N_IMAGE=n8nio/n8n:2.42.7` (not staging `2.44.1`).
- **Synarava** (`synarava-shop`): HTTPS client only.

Staging plan: `docs/runbooks/portable-sku-platform-railway.md`.
Production Stage 6: `docs/runbooks/portable-sku-platform-production.md`.
n8n staging steps: `docs/runbooks/sku-catalog-audit-staging.md`.

## Safe adoption + plan (never apply without explicit go)

| Env | Helper |
| --- | --- |
| staging | [`scripts/sku-platform-staging-adopt-check.sh`](../scripts/sku-platform-staging-adopt-check.sh) |
| production | [`scripts/sku-platform-production-adopt-check.sh`](../scripts/sku-platform-production-adopt-check.sh) → wired [`sku-platform-production-plan-check.sh`](../scripts/sku-platform-production-plan-check.sh) |

CLI: [railway config](https://docs.railway.com/cli/config) — `pull`, `partials`, `plan`, `apply`.

### Staging

```bash
railway link --project portable-sku-platform --environment staging
./scripts/sku-platform-staging-adopt-check.sh
pnpm install --frozen-lockfile && railway config plan
# apply ONLY after Kiryl OK + staging plan gate
```

### Production (Stage 6)

```bash
railway link --project portable-sku-platform --environment production
./scripts/sku-platform-production-adopt-check.sh
# Runs plan+gate via sku-platform-production-plan-check.sh (HARD FAIL if gate fails)
# Plan must create ONLY sku-api + sku-postgres
# ZERO create/delete/replace of sku-platform-n8n* / sku-platform-n8n-volume / postgres-volume
# apply ONLY after Business Owner + Kiryl explicit go
```

## Watch paths + check suites (authored in `railway.ts`)

`sku-api` must keep live settings that a string `build` / bare `github()` would drop on `config plan`:

- `source.checkSuites: true`
- `build.watchPatterns` (exact list below)

### portable-sku-platform → `sku-api`

```
/services/sku-api/**
/packages/sku-core/**
/packages/sku-contract/**
/pnpm-lock.yaml
/pnpm-workspace.yaml
/package.json
```

Production GitHub branch: protected `main` (`PROD_SKU_API_GITHUB_BRANCH`). The production plan-check fails unless current `origin/main` contains the complete `origin/staging` history merged through PR #148.

### synarava-shop → `synarava-shop-app` (web)

Do **not** include `services/sku-api/**` or `packages/sku-*/**` in the web service watch paths.
