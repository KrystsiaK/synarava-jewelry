# Portable SKU platform — Railway (architecture)

**ADR:** [`docs/adr/0004-portable-sku-service-boundary.md`](../adr/0004-portable-sku-service-boundary.md) (amendment 2026-10-14; rename note)  
**Proposal:** [`docs/proposals/portable-sku-service.md`](../proposals/portable-sku-service.md) §10.1  
**IaC:** [`.railway/railway.ts`](../../.railway/railway.ts)  
**Gate:** **Do not `railway config apply` until Kiryl confirms this plan.**

## Target (current)

| Item | Value |
| --- | --- |
| Platform project | **`portable-sku-platform`** (renamed from `handsome-commitment`) |
| Immutable project ID | **`6d7d5885-43eb-4283-b4a4-e552fc6dba7b`** |
| Staging inventory | **`sku-api`** + **`sku-postgres`** only (Online). **No n8n in staging yet.** |
| Shop project | **`synarava-shop`** — web only |
| Client access | HTTPS + Bearer + rate limit (`SKU_API_RATE_LIMIT_PER_MIN`) |
| Code | Monorepo (for now) |

## Audit snapshot

| Evidence | Finding |
| --- | --- |
| GitHub status (pre-rename) on `cc5fd77` | check context `handsome-commitment - sku-api` → project ID `6d7d5885-43eb-4283-b4a4-e552fc6dba7b` |
| Kiryl (2026-10-14) | Project **renamed** → `portable-sku-platform`; **ID unchanged** |
| Kiryl staging UI | Only `sku-api` + `sku-postgres` Online — **no staging n8n** |
| GitHub status on `cc5fd77` | `synarava-shop - synarava-shop-app` → web only (`fe392310-…`) |
| Missing status | No `synarava-shop - sku-api` on recent staging tips |
| Production dashboard | Confirm in UI only; **do not change prod** |

### Production services (read-only; separate cutover)

In **portable-sku-platform** production, confirm without changing:

- [ ] `sku-platform-n8n`
- [ ] `sku-platform-n8n-postgres`
- [ ] Whether prod `sku-api` / `sku-postgres` share that project

**Do not edit prod now.** Staging must not invent n8n to “match” prod.

## Why not synarava-shop for sku-api

1. Multi-workspace platform ≠ single-shop deploy unit.  
2. Railway private networking does not cross projects — Synarava already needs HTTPS to call a foreign project.  
3. Creating a second sku-api in synarava-shop duplicates the data plane and fights the live platform deploy trigger.

## IaC partial behaviour (after confirmation)

```bash
railway link --project portable-sku-platform --environment staging
# project ID 6d7d5885-43eb-4283-b4a4-e552fc6dba7b
railway config plan   # review only
# railway config apply  # ONLY after Kiryl OK
```

- Staging only; refuses production.  
- Refuses `synarava-shop`.  
- Guard keys on **immutable project ID** (not display name).  
- Owns `sku-api` + `sku-postgres` only — **does not create n8n**.

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
**Staging has no n8n yet** — do not invent a staging n8n service via this IaC partial.  
When Kiryl approves adding staging n8n later, import into **platform** n8n and set `SKU_API_URL=https://…`.  
Until then, use the API dry-run CLI against staging sku-api. Do not modify production `sku-platform-n8n` from staging ops.

## Migration (summary)

Rename is **done** (same project ID). Remaining: confirm apply gate, then staging `config plan`/`apply` for sku-api+sku-postgres only; add staging n8n only under separate approval; prod cutover separate.

## Rollback

- If apply never ran: staging services stay as today (`sku-api` + `sku-postgres`).  
- If apply already ran: do not delete prod; disconnect GitHub trigger / revert IaC only under Kiryl direction.
