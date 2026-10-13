# Portable SKU service

**Status:** Этап 1–4 code on staging (sku-api + Synarava adapter + staging matrix) · Этап 5–6 not started  
**ADR:** [`docs/adr/0004-portable-sku-service-boundary.md`](../adr/0004-portable-sku-service-boundary.md)  
**Plan:** [`docs/proposals/portable-sku-service.md`](../proposals/portable-sku-service.md)  
**Staging matrix:** [`docs/testing/portable-sku-staging-matrix.md`](../testing/portable-sku-staging-matrix.md)  
**Railway staging:** [`docs/runbooks/sku-api-railway-staging.md`](../runbooks/sku-api-railway-staging.md)

## Packages

| Package | Role |
| --- | --- |
| `packages/sku-core` | Pure domain: normalize, stem, format/parse/validate, preview. No Shopify/Next/Prisma/HTTP. |
| `packages/sku-contract` | Zod `/v1` schemas + typed `createSkuClient`. Consumed by Next via `transpilePackages` (extensionless TS imports — not Node `.js` suffixes). |
| `services/sku-api` | Prisma registry + Postgres/`SkuRegistryStore`, allocator, legacy importer, HTTP `/v1` + auth. Railway: IaC partial `.railway/railway.ts` (not root CaC). |

## Persistence

| Condition | Store |
| --- | --- |
| `SKU_DATABASE_URL` set | Prisma PostgreSQL (`createPrismaSkuRegistryStore`) — staging/production |
| unset | In-memory serializable store — unit tests / local without DB |

Factory: `createSkuStoreRuntime()` in `services/sku-api/src/registry/create-store.ts`.

## HTTP (Этап 2)

- `GET /health` — ready when credentials configured **and** DB reachable (Postgres mode); body includes `store`
- `POST /v1/workspaces/{key}/skus/preview|validate`
- `POST /v1/workspaces/{key}/reservations` (+ `Idempotency-Key`)
- `POST /v1/workspaces/{key}/assignments/confirm`
- `POST /v1/workspaces/{key}/assignments/{id}/lock`
- `GET /v1/workspaces/{key}/assignments` · `GET …/audit-events`
- `GET|POST /v1/workspaces/{key}/profiles` · `POST …/profiles/{version}/publish`

Auth: `Authorization: Bearer <token>` scoped to path workspace.

```bash
node services/sku-api/scripts/generate-credentials.mjs synarava-shop
```

Prints `SKU_API_CREDENTIALS` (hashed, for sku-api) and plaintext `SKU_API_TOKEN` (for synarava-web) separately. Local-only fallback: `SKU_API_DEV_TOKEN`.

Railway staging: [`docs/runbooks/sku-api-railway-staging.md`](../runbooks/sku-api-railway-staging.md) — web CaC at `deploy/railway.synarava-web.json`; sku-api via IaC (Config as Code deprecated for new services).

Synarava server env (never expose to browser): `SKU_API_URL`, `SKU_API_TOKEN`, optional `SKU_API_WORKSPACE` (default `synarava-shop`).

## Bootstrap

On start (unless `SKU_BOOTSTRAP=0`): idempotent ensure of workspace `synarava-shop` + published profile v1.  
**Do not** use `SKU_SEED_EXAMPLE` on staging/production (removed from the runtime path).

## Admin UI

Shared → **SKU policy** (`/admin/settings#shared-sku-policy`): draft/publish profile, read-only assignments + audit. Shows a staging-gate alert when the SKU API env is unset.

Product → **Inventory**: when sku-api is configured, each local variant row uses Preview / Confirm assign (`ProductSkuAssignPanel`). Linked variants run reserve → Shopify write → read-back → confirm; unlinked reserve locally and confirm on Push. **Retry confirm** resumes a pending reservation without a new sequence (idempotent).

## Synarava adapter (Этап 3–4)

| Piece | Path |
| --- | --- |
| Orchestrator | `lib/sku/assign-variant-sku.ts` (`assignVariantSku`, `resumePendingSkuAssignment`) |
| Shopify SKU writer / reader | `lib/sku/write-shopify-variant-sku.ts`, `lib/sku/read-shopify-variant-sku.ts` |
| Pending local identity | `lib/sku/pending-sku.ts` (`PENDING-*`, legacy `SKU-*` draft tokens) |
| Pending reservation JSON | `Product.details.skuAssignmentPendings[variantId]` (legacy `skuAssignmentPending` still read) |
| Server actions | `app/admin/actions/sku-assign.ts` |
| Push gate + confirm-on-push | `lib/shopify/product-sync.ts` `pushProductToShopify` |
| Staging matrix | [`docs/testing/portable-sku-staging-matrix.md`](../testing/portable-sku-staging-matrix.md) |

Autosave no longer invents `SKU-*` commerce tokens when sku-api is configured (`PENDING-*` only). Push refuses pending placeholders without a reserved pending assignment. `Product.sku` mirrors the **primary** variant only when a non-primary variant is assigned.

## Boundary (unchanged)

- Shopify owns assigned Variant SKU ([ADR-0002](../adr/0002-shopify-catalog-ownership.md)).
- Conflict compare remains normalize + deep-diff ([ADR-0003](../adr/0003-commerce-conflict-deep-diff.md)).
- Synarava is client + Shopify adapter only ([ADR-0004](../adr/0004-portable-sku-service-boundary.md)).

## Tests

```bash
pnpm test:sku                                          # unit (memory store)
pnpm exec vitest run lib/sku/__tests__                 # adapter + pending helpers + resume
pnpm --filter @synarava/sku-api test:integration       # real PostgreSQL
```

Postgres integration covers persist-across-reconnect, **parallel same-stem unique sequences**, and concurrent identical idempotency keys. Serializable reserve retries `P2034` / unique races (`P2002`) with a bounded backoff.

## Not done yet

- Full retirement of dual `Product.sku` identity
- Push writing every variant SKU (still primary-focused on Push path)
- n8n recovery/audit, production rollout (Этап 5–6)
- Manual matrix rows M6 / M9–M11 / M13; M2 empty-Pull Fail→fix (re-verify); M3/M4/M5/M7/M8/M12 closed by automated fixtures

