# Railway Infrastructure as Code — portable SKU platform

Canonical docs: [Infrastructure as Code](https://docs.railway.com/infrastructure-as-code) · [Monorepo deploys](https://docs.railway.com/deployments/monorepo)

| File | Role |
| --- | --- |
| `.railway/railway.ts` | Named partial `sku` — interim **handsome-commitment / staging** `sku-api` + `sku-postgres` |
| `deploy/railway.synarava-web.json` | Legacy CaC for **synarava-web** in project **synarava-shop** only |
| `deploy/n8n/sku-catalog-audit.workflow.json` | Catalog-audit workflow (import into platform n8n after cutover) |

## Architecture (locked direction)

- **Target** Railway project: `portable-sku-platform` (multi-workspace API).
- **Interim:** existing staging `sku-api` / `sku-postgres` in **`handsome-commitment`**.
- **Synarava** (`synarava-shop`) is a **client** over **HTTPS** — never host a second sku-api there; never use cross-project private `${{sku-api.*}}`.
- **Production:** do not apply this partial; existing `sku-platform-n8n` / `sku-platform-n8n-postgres` are read-only until a separate cutover.

Full plan: `docs/runbooks/portable-sku-platform-railway.md`.

## Apply (staging only — after Kiryl confirmation)

```bash
railway login
railway link --project handsome-commitment --environment staging
pnpm install --frozen-lockfile
railway config plan
# Expect: handsome-commitment/staging; sku-api + sku-postgres only.
# Abort on unexpected destroy or any synarava-shop target.
# Do NOT apply until Kiryl confirms the architecture plan.
railway config apply
```

Guard refuses: non-staging environments, `synarava-shop`, and any project other than `handsome-commitment` (until `SKU_PLATFORM_PROJECT` is flipped to `portable-sku-platform`).

## Watch paths (dashboard — deploy triggers)

### handsome-commitment → `sku-api` (staging)

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

Do **not** include `services/sku-api/**` or `packages/sku-*/**` in the web service watch paths (SKU-only commits must not rebuild the storefront).
