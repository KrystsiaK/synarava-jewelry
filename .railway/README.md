# Railway Infrastructure as Code — portable SKU platform

Canonical docs: [Infrastructure as Code](https://docs.railway.com/infrastructure-as-code) · [Monorepo deploys](https://docs.railway.com/deployments/monorepo) · [n8n on Railway](https://docs.railway.com/guides/n8n)

| File | Role |
| --- | --- |
| `.railway/railway.ts` | Named partial `sku` — staging `sku-api` + `sku-postgres` + `n8n` + `n8n-postgres` + `n8n-data` |
| `deploy/railway.synarava-web.json` | Legacy CaC for **synarava-web** in project **synarava-shop** only |
| `deploy/n8n/sku-catalog-audit.workflow.json` | Catalog-audit workflow (import into **staging** n8n) |

## Architecture

- **Railway project:** `portable-sku-platform` (ID `6d7d5885-43eb-4283-b4a4-e552fc6dba7b`).
- **IaC guard:** immutable **project ID** (not display name); staging only; refuses `synarava-shop` and production.
- **Staging target:** `sku-api`, `sku-postgres`, **staging `n8n`**, **`n8n-postgres`** (separate from sku DB), **`n8n-data`** volume.
- **Current fact:** staging may already have only `sku-api` + `sku-postgres` Online — IaC **creates** staging n8n resources; it must **adopt** existing sku resources (see apply gate).
- **Production:** never apply this partial; do not modify `sku-platform-n8n*`.
- **Synarava** (`synarava-shop`): HTTPS client only.

Full plan: `docs/runbooks/portable-sku-platform-railway.md`.  
n8n steps: `docs/runbooks/sku-catalog-audit-staging.md`.

## Safe adoption + apply (staging only — after Kiryl confirmation)

Exact sequence helper: [`scripts/sku-platform-staging-adopt-check.sh`](../scripts/sku-platform-staging-adopt-check.sh)  
CLI: [railway config](https://docs.railway.com/cli/config) — `pull`, `partials`, `plan`, `apply`.

```bash
railway login
railway link --project portable-sku-platform --environment staging
# project ID 6d7d5885-43eb-4283-b4a4-e552fc6dba7b
railway status --environment staging --json   # .id + edges[0].node.name = project / staging

# BEFORE plan (required):
mkdir -p .railway/local
railway config pull --json --environment staging > .railway/local/sku-platform-staging.pull.json
railway config partials list
# Transfer to partial `sku` only if another named partial owns sku-api/sku-postgres

pnpm install --frozen-lockfile
railway config plan
```

**Apply allowed only if** the plan:

- Does **not** create / delete / replace existing **`sku-postgres`**, its volume, or **`sku-api`**
- May **create** staging `n8n`, `n8n-postgres`, `n8n-data` (expected)
- Does **not** target production or `synarava-shop`
- Shows **no** unexpected destroy of unrelated services

```bash
# ONLY after Kiryl OK + plan gate above
railway config apply
```

## Watch paths + check suites (authored in `railway.ts`)

`sku-api` must keep live staging settings that a string `build` / bare `github()` would drop on `config plan`:

- `source.checkSuites: true`
- `build.watchPatterns` (exact list below)

### portable-sku-platform → `sku-api` (staging)

```
/services/sku-api/**
/packages/sku-core/**
/packages/sku-contract/**
/pnpm-lock.yaml
/pnpm-workspace.yaml
/package.json
/.railway/**
```

### synarava-shop → `synarava-shop-app` (web)

Do **not** include `services/sku-api/**` or `packages/sku-*/**` in the web service watch paths.
