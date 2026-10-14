# SKU API — Railway staging (client + interim platform)

**Canonical platform architecture:** [`portable-sku-platform-railway.md`](portable-sku-platform-railway.md)  
**ADR amendment:** [`docs/adr/0004-portable-sku-service-boundary.md`](../adr/0004-portable-sku-service-boundary.md)

Staging checklist for Synarava **as HTTPS client** and the **interim** SKU platform project.  
**Do not configure production here. Do not `railway config apply` until Kiryl confirms the platform plan.**

## GitHub check triage

| Check name pattern | Source | Meaning |
| --- | --- | --- |
| `Quality Gates`, `Storefront smoke…` | **GitHub Actions** | Repo CI |
| `SKU Quality Gates` | **GitHub Actions** | sku path workflow |
| `synarava-shop - synarava-shop-app` | **Railway** | Web deploy in **synarava-shop** |
| `handsome-commitment - sku-api` | **Railway** | **Live** staging sku-api in **handsome-commitment** (interim platform) |

There is intentionally **no** requirement for `synarava-shop - sku-api`. Do **not** create a duplicate sku-api next to the storefront.

## Project roles

| Railway project | Owns | Does not own |
| --- | --- | --- |
| `synarava-shop` | Storefront / Admin (`synarava-shop-app`) | sku-api, sku-postgres, platform n8n |
| `handsome-commitment` (interim) | staging `sku-api`, `sku-postgres` | Synarava web |
| `portable-sku-platform` (target) | Future home of API + DB + n8n | Synarava web |

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
railway link --project handsome-commitment --environment staging
railway config plan
# Apply ONLY after Kiryl confirmation — see portable-sku-platform-railway.md
```

Partial `sku` manages `sku-api` + `sku-postgres` only. Guard refuses `synarava-shop` and production.

## Watch paths

**sku-api (handsome-commitment):**

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

Out of scope. Existing `sku-platform-n8n` / `sku-platform-n8n-postgres` are documented for read-only confirmation in [`portable-sku-platform-railway.md`](portable-sku-platform-railway.md). No prod apply from this runbook.
