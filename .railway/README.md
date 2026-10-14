# Railway Infrastructure as Code — portable SKU platform

Canonical docs: [Infrastructure as Code](https://docs.railway.com/infrastructure-as-code) · [Monorepo deploys](https://docs.railway.com/deployments/monorepo)

| File | Role |
| --- | --- |
| `.railway/railway.ts` | Named partial `sku` — **portable-sku-platform / staging** `sku-api` + `sku-postgres` |
| `deploy/railway.synarava-web.json` | Legacy CaC for **synarava-web** in project **synarava-shop** only |
| `deploy/n8n/sku-catalog-audit.workflow.json` | Catalog-audit workflow (import into platform n8n when staging n8n exists) |

## Architecture (locked)

- **Railway project:** `portable-sku-platform` (renamed from `handsome-commitment`).
- **Immutable project ID:** `6d7d5885-43eb-4283-b4a4-e552fc6dba7b` — IaC guard keys on this ID, not the display name.
- **Staging inventory (fact):** `sku-api` + `sku-postgres` only (Online). **No n8n in staging yet.**
- **Synarava** (`synarava-shop`) is a **client** over **HTTPS** — never host a second sku-api there; never use cross-project private `${{sku-api.*}}`.
- **Production:** do not apply this partial; prod automation (e.g. `sku-platform-n8n*`) is read-only until a separate cutover.

Full plan: `docs/runbooks/portable-sku-platform-railway.md`.

## Apply (staging only — after Kiryl confirmation)

```bash
railway login
railway link --project portable-sku-platform --environment staging
# Or link by ID: 6d7d5885-43eb-4283-b4a4-e552fc6dba7b
pnpm install --frozen-lockfile
railway config plan
# Expect: portable-sku-platform/staging; sku-api + sku-postgres only.
# Abort on unexpected destroy, any n8n create, or any synarava-shop target.
# Do NOT apply until Kiryl confirms the architecture plan.
railway config apply
```

Guard refuses: non-staging environments, `synarava-shop`, missing `projectId`, and any project ID other than `6d7d5885-43eb-4283-b4a4-e552fc6dba7b`.

## Watch paths (dashboard — deploy triggers)

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

Do **not** include `services/sku-api/**` or `packages/sku-*/**` in the web service watch paths (SKU-only commits must not rebuild the storefront).
