# SKU API — Railway staging (client + platform)

**Canonical platform architecture:** [`portable-sku-platform-railway.md`](portable-sku-platform-railway.md)  
**ADR amendment:** [`docs/adr/0004-portable-sku-service-boundary.md`](../adr/0004-portable-sku-service-boundary.md)

Staging checklist for Synarava **as HTTPS client** and the SKU platform project.  
**Do not configure production here. Do not `railway config apply` until Kiryl confirms the platform plan.**

## GitHub check triage

| Check name pattern | Source | Meaning |
| --- | --- | --- |
| `Quality Gates`, `Storefront smoke…` | **GitHub Actions** | Repo CI |
| `SKU Quality Gates` | **GitHub Actions** | sku path workflow |
| `synarava-shop - synarava-shop-app` | **Railway** | Web deploy in **synarava-shop** |
| `portable-sku-platform - sku-api` (or legacy `handsome-commitment - sku-api`) | **Railway** | Staging sku-api in project ID `6d7d5885-43eb-4283-b4a4-e552fc6dba7b` |

There is intentionally **no** requirement for `synarava-shop - sku-api`. Do **not** create a duplicate sku-api next to the storefront.

## Project roles

| Railway project | ID | Owns | Does not own |
| --- | --- | --- | --- |
| `synarava-shop` | `fe392310-…` | Storefront / Admin (`synarava-shop-app`) | sku-api, sku-postgres, platform n8n |
| `portable-sku-platform` | `6d7d5885-43eb-4283-b4a4-e552fc6dba7b` | staging `sku-api`, `sku-postgres` (Online) | Synarava web; **no staging n8n yet** |

## Synarava web env (staging)

| Variable | Value |
| --- | --- |
| `SKU_API_URL` | Public **HTTPS** URL of staging sku-api (no trailing slash) |
| `SKU_API_TOKEN` | Bearer for workspace `synarava-shop` |
| `SKU_API_WORKSPACE` | `synarava-shop` (optional default) |

**Do not** set `SKU_API_URL=http://${{sku-api.RAILWAY_PRIVATE_DOMAIN}}:…` on the web service — that reference only works inside the same Railway project.

Generate credentials:

```bash
node services/sku-api/scripts/generate-credentials.mjs synarava-shop
```

## IaC (platform staging)

```bash
railway link --project portable-sku-platform --environment staging
railway config plan
# Apply ONLY after Kiryl confirmation — see portable-sku-platform-railway.md
```

Partial `sku` manages `sku-api` + `sku-postgres` only. Guard refuses `synarava-shop`, production, and any project ID other than `6d7d5885-43eb-4283-b4a4-e552fc6dba7b`.

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

**synarava-web:** omit the sku paths above so SKU-only commits do not rebuild the shop.

## Health

```bash
curl -sS "$SKU_API_URL/health"
```

Expect `ready: true` with `store: "postgres"` on staging.

## Production

Out of scope. Existing `sku-platform-n8n` / `sku-platform-n8n-postgres` (if present) are documented for read-only confirmation in [`portable-sku-platform-railway.md`](portable-sku-platform-railway.md). No prod apply from this runbook.
