# Portable SKU platform — Railway (architecture)

**ADR:** [`docs/adr/0004-portable-sku-service-boundary.md`](../adr/0004-portable-sku-service-boundary.md) (amendment 2026-10-14)  
**Proposal:** [`docs/proposals/portable-sku-service.md`](../proposals/portable-sku-service.md) §10.1  
**IaC:** [`.railway/railway.ts`](../../.railway/railway.ts)  
**Gate:** **Do not `railway config apply` until Kiryl confirms this plan.**

## Target

| Item | Value |
| --- | --- |
| Platform project | **`portable-sku-platform`** |
| Interim staging project | **`handsome-commitment`** (live `sku-api` check today) |
| Shop project | **`synarava-shop`** — web only |
| Client access | HTTPS + Bearer + rate limit (`SKU_API_RATE_LIMIT_PER_MIN`) |
| Code | Monorepo (for now) |

## Read-only audit snapshot (agent, 2026-10-14)

| Evidence | Finding |
| --- | --- |
| GitHub status on `cc5fd77` | `handsome-commitment - sku-api` → project `6d7d5885-43eb-4283-b4a4-e552fc6dba7b` |
| GitHub status on `cc5fd77` | `synarava-shop - synarava-shop-app` → web only (`fe392310-…`) |
| Missing status | No `synarava-shop - sku-api` on recent staging tips |
| Production dashboard | **Not queried** (no Railway token in this environment) |

### Production services to confirm in UI (read-only)

Kiryl: in **handsome-commitment** (or current SKU project) production, confirm without changing:

- [ ] `sku-platform-n8n`
- [ ] `sku-platform-n8n-postgres`
- [ ] Whether prod `sku-api` / `sku-postgres` share that project

These names are the existing platform automation footprint — migrate later; **do not edit prod now**.

## Why not synarava-shop for sku-api

1. Multi-workspace platform ≠ single-shop deploy unit.  
2. Railway private networking does not cross projects — Synarava already needs HTTPS to call a foreign project.  
3. Creating a second sku-api in synarava-shop duplicates data plane and fights the live handsome-commitment trigger.

## IaC partial behaviour (after confirmation)

```bash
railway link --project handsome-commitment --environment staging
railway config plan   # review only
# railway config apply  # ONLY after Kiryl OK
```

- Staging only; refuses production.  
- Refuses `synarava-shop`.  
- Owns `sku-api` + `sku-postgres` only (no n8n create in this partial).  
- Flip `SKU_PLATFORM_PROJECT` to `portable-sku-platform` after rename/create.

## Synarava web env (staging)

| Variable | Value |
| --- | --- |
| `SKU_API_URL` | `https://<public-sku-api-host>` (no trailing slash; **not** private `${{sku-api.*}}`) |
| `SKU_API_TOKEN` | Staging Bearer for workspace `synarava-shop` |
| `SKU_API_WORKSPACE` | `synarava-shop` |

## Watch paths / CI

| Surface | Paths that should trigger deploy/CI |
| --- | --- |
| Platform `sku-api` | `services/sku-api/**`, `packages/sku-core/**`, `packages/sku-contract/**`, lockfile/workspace, `.railway/**` |
| Shop web | `app/**`, `components/**`, `lib/**` (except pure sku-only when possible), `prisma/**`, `deploy/railway.synarava-web.json` |

GitHub: storefront smoke is path-filtered; SKU workflow runs on sku paths. Quality Gates still run on PRs.

## Catalog audit (n8n)

Workflow JSON remains at `deploy/n8n/sku-catalog-audit.workflow.json`.  
Import into **platform** n8n (interim prod host `sku-platform-n8n`, or staging n8n after cutover).  
Set `SKU_API_URL=https://…` — never a synarava-shop private domain.

## Migration (summary)

See store plan `docs/portable-sku-platform-architecture.md` (agent store) and Phase 0–2 there. **Stop after docs land for Kiryl confirmation.**

## Rollback

- Leave handsome-commitment staging as-is if apply never ran.  
- If apply already ran: do not delete prod; revert IaC constant / disconnect GitHub trigger only under Kiryl direction.
