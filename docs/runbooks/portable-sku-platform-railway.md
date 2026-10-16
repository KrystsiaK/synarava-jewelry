# Portable SKU platform — Railway (architecture)

**ADR:** [`docs/adr/0004-portable-sku-service-boundary.md`](../adr/0004-portable-sku-service-boundary.md)  
**Proposal:** [`docs/proposals/portable-sku-service.md`](../proposals/portable-sku-service.md) §10.1  
**IaC:** [`.railway/railway.ts`](../../.railway/railway.ts)  
**n8n ops:** [`sku-catalog-audit-staging.md`](sku-catalog-audit-staging.md)  
**Gate:** **Do not `railway config apply` until Kiryl confirms** after a green `config plan`.

## Target vs current

| | Staging (`portable-sku-platform`) | Production |
| --- | --- | --- |
| **Target** | `sku-api`, `sku-postgres`, **staging `n8n`**, **`n8n-postgres`**, **`n8n-data-v2`** | Adopt `sku-platform-n8n*` + volumes; **create** `sku-api` + `sku-postgres` |
| **Current fact** | Staging n8n path per Stage 5 smoke | `sku-platform-n8n` + `sku-platform-n8n-postgres` exist; **no** prod `sku-api` / `sku-postgres` yet |

Staging IaC adopts existing sku-api/sku-postgres and manages staging n8n*. **Production Stage 6** is a separate runbook: [`portable-sku-platform-production.md`](portable-sku-platform-production.md) (same `.railway/railway.ts`, production branch + env-ID guard).

## Identity

| Item | Value |
| --- | --- |
| Display name | **`portable-sku-platform`** (renamed from `handsome-commitment`) |
| Immutable project ID | **`6d7d5885-43eb-4283-b4a4-e552fc6dba7b`** (IaC guard) |
| Shop project | **`synarava-shop`** — web only (HTTPS client) |
| Client access (Synarava) | HTTPS + Bearer + rate limit |
| n8n → sku-api | Same-project private `${{sku-api.*}}` |

## Safe adoption flow (existing sku-api / sku-postgres)

Do this **only** for project ID `6d7d5885-…` / environment **staging**.  
Helper script (same sequence): [`scripts/sku-platform-staging-adopt-check.sh`](../../scripts/sku-platform-staging-adopt-check.sh)  
CLI reference: [railway config](https://docs.railway.com/cli/config) (`pull`, `partials`, `plan`).

**Exact sequence before `config plan`:**

1. **Link + verify**
   ```bash
   railway link --project portable-sku-platform --environment staging
   railway status --environment staging --json   # .id + GraphQL edges[0].node.name must be project 6d7d5885-… / staging
   ```
   Helper script enforces this check. Never override toward production via env.
2. **`railway config pull` (inspect — do not overwrite committed authoring)**
   ```bash
   # JSON inspect keeps committed .railway/railway.ts intact
   railway config pull --json --environment staging > .railway/local/sku-platform-staging.pull.json
   ```
   Confirm the live graph includes services named **`sku-api`** and **`sku-postgres`** (name match is how IaC adopts without recreate).  
   Do **not** `railway config pull --force` over the committed authoring file. Pull JSON stays under `.railway/local/` (ignored).
3. **`railway config partials` (ownership check)**
   ```bash
   railway config partials list
   # optional machine-readable:
   railway config partials list --json
   ```
   - Named partial in this repo: **`sku`** (see `export const partial = "sku"` in `.railway/railway.ts`).
   - Expect `sku-api` / `sku-postgres` either **unowned** (`*` / whole-project) or already owned by **`sku`**.
   - If another named partial owns them, **transfer** (dry-run first) using exact addresses from the list — e.g.:
     ```bash
     railway config partials transfer <source> sku \
       --resource service.sku-api \
       --resource database.sku-postgres \
       --dry-run
     # then drop --dry-run after Kiryl OK
     ```
   - Never release/transfer production `sku-platform-n8n*` from this flow.
4. **Plan** (only after pull + partials check)
   ```bash
   pnpm install --frozen-lockfile
   railway config plan
   ```
5. **Apply gate — abort unless all true**
   - [ ] Plan environment is **staging**
   - [ ] Project ID matches `6d7d5885-43eb-4283-b4a4-e552fc6dba7b`
   - [ ] **No** create / delete / replace of existing **`sku-postgres`** (or its volume)
   - [ ] **No** create / delete / replace of existing **`sku-api`**
   - [ ] **Allowed:** create staging **`n8n`**, **`n8n-postgres`**, **`n8n-data`**
   - [ ] **No** changes to production services / `sku-platform-n8n*`
   - [ ] **No** resources in `synarava-shop`
6. **Apply** — only after Kiryl OK + gate above:
   ```bash
   railway config apply
   ```
7. Finish n8n domain + secrets + workflow import per [`sku-catalog-audit-staging.md`](sku-catalog-audit-staging.md).

## Why not synarava-shop for sku-api / n8n

1. Multi-workspace platform ≠ single-shop deploy unit.  
2. Cross-project private refs unavailable — Synarava web uses HTTPS.  
3. Staging n8n belongs in the platform project next to sku-api (private URL OK).  
4. Production n8n must not be reused or modified for staging.

## Synarava web env (staging)

| Variable | Value |
| --- | --- |
| `SKU_API_URL` | `https://<public-sku-api-host>` (**not** private `${{sku-api.*}}`) |
| `SKU_API_TOKEN` | Staging Bearer for workspace `synarava-shop` |
| `SKU_API_WORKSPACE` | `synarava-shop` |

## Staging n8n → sku-api (same project)

| Variable | Value |
| --- | --- |
| `SKU_API_URL` | `http://${{sku-api.RAILWAY_PRIVATE_DOMAIN}}:8080` — **literal `:8080`** (`${{sku-api.PORT}}` resolves empty) |
| `N8N_BLOCK_ENV_ACCESS_IN_NODE` | `false` so Code nodes can read workspace/chat runtime settings |
| `TELEGRAM_CHAT_ID` | Staging ops chat for **Notify Telegram · SKU** (sealed; bot token in n8n credential only) |

Catalog rows are loaded live from Shopify through the protected Synarava endpoint; catalog JSON is no longer an operational input.
IaC temporarily preserves any legacy `CATALOG_ITEMS_JSON` value so a routine apply cannot delete existing state; the workflow does not read it.

## Watch paths / CI

Authored in `.railway/railway.ts` (`build.watchPatterns` + `source.checkSuites: true`) so `config plan` does not clear live staging settings.

| Surface | Paths |
| --- | --- |
| Platform `sku-api` | `services/sku-api/**`, `packages/sku-core/**`, `packages/sku-contract/**`, lockfile/workspace (exact live list — no `.railway/**`) |
| Shop web | storefront paths; **omit** sku packages |

## Production

Stage 6 production adopt/create is documented in [`portable-sku-platform-production.md`](portable-sku-platform-production.md) (hard guards on project ID + production environment ID). **Do not apply production from this staging runbook.**

## Rollback

- If apply never ran: staging stays `sku-api` + `sku-postgres`.  
- If apply created n8n*: deactivate workflow; stop/delete staging `n8n` / `n8n-postgres` / volume under Kiryl direction — **never** delete `sku-postgres` / `sku-api` casually.  
- Prod untouched.
