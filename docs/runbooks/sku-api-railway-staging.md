# SKU API — Railway staging (client + platform)

**Canonical platform architecture:** [`portable-sku-platform-railway.md`](portable-sku-platform-railway.md)  
**n8n / catalog audit:** [`sku-catalog-audit-staging.md`](sku-catalog-audit-staging.md)  
**ADR amendment:** [`docs/adr/0004-portable-sku-service-boundary.md`](../adr/0004-portable-sku-service-boundary.md)

Staging checklist for Synarava **as HTTPS client** and the SKU platform project.  
**Do not configure production here. Do not `railway config apply` until Kiryl confirms after `config plan`.**

## GitHub check triage

| Check name pattern | Source | Meaning |
| --- | --- | --- |
| `Quality Gates`, `Storefront smoke…` | **GitHub Actions** | Repo CI |
| `SKU Quality Gates` | **GitHub Actions** | sku path workflow |
| `synarava-shop - synarava-shop-app` | **Railway** | Web deploy in **synarava-shop** |
| `portable-sku-platform - sku-api` (or legacy `handsome-commitment - sku-api`) | **Railway** | Staging sku-api in project ID `6d7d5885-43eb-4283-b4a4-e552fc6dba7b` |

There is intentionally **no** requirement for `synarava-shop - sku-api`.

## Project roles

| Railway project | ID | Staging target | Does not own |
| --- | --- | --- | --- |
| `synarava-shop` | `fe392310-…` | Storefront / Admin | sku-api, sku-postgres, platform n8n |
| `portable-sku-platform` | `6d7d5885-43eb-4283-b4a4-e552fc6dba7b` | `sku-api`, `sku-postgres`, staging `n8n`, `n8n-postgres`, `n8n-data` | Synarava web; prod `sku-platform-n8n*` |

**Current fact:** staging may only have `sku-api` + `sku-postgres` Online. Target adds staging n8n + separate persistence.

## Synarava web env (staging)

| Variable | Value |
| --- | --- |
| `SKU_API_URL` | Public **HTTPS** URL of staging sku-api (no trailing slash) |
| `SKU_API_TOKEN` | Bearer for workspace `synarava-shop` |
| `SKU_API_WORKSPACE` | `synarava-shop` (optional default) |

**Do not** set `SKU_API_URL=http://${{sku-api.RAILWAY_PRIVATE_DOMAIN}}:…` on the web service.

```bash
node services/sku-api/scripts/generate-credentials.mjs synarava-shop
```

## IaC (platform staging)

See **Safe adoption flow** in [`portable-sku-platform-railway.md`](portable-sku-platform-railway.md)  
Script: [`scripts/sku-platform-staging-adopt-check.sh`](../../scripts/sku-platform-staging-adopt-check.sh)

```bash
railway link --project portable-sku-platform --environment staging
railway config pull --json --environment staging > /tmp/sku-platform-staging.pull.json
railway config partials list
railway config plan
# Apply ONLY after Kiryl confirmation + apply gate (no recreate of existing sku-api/sku-postgres)
```

Guard: immutable project ID; refuses `synarava-shop` and production.

Rate limits on `sku-api`: `SKU_API_PRE_AUTH_RATE_LIMIT_PER_MIN` (workspace+IP, before scrypt) then `SKU_API_RATE_LIMIT_PER_MIN` (post-auth credential fingerprint).

## Watch paths

**sku-api (portable-sku-platform):**

```
/services/sku-api/**
/packages/sku-core/**
/packages/sku-contract/**
/pnpm-lock.yaml
/pnpm-workspace.yaml
/package.json
/.railway/**
```

**synarava-web:** omit the sku paths above.

## Health

```bash
curl -sS "$SKU_API_URL/health"
```

Expect `ready: true` with `store: "postgres"` on staging.

## Production

Out of scope. Do not modify `sku-platform-n8n` / `sku-platform-n8n-postgres`.
