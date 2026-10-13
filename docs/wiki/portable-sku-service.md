# Portable SKU service

**Status:** Этап 1–2 deploy-ready on staging (Postgres adapter + bootstrap) · Synarava Shopify adapter (Этап 3+) not started  
**ADR:** [`docs/adr/0004-portable-sku-service-boundary.md`](../adr/0004-portable-sku-service-boundary.md)  
**Plan:** [`docs/proposals/portable-sku-service.md`](../proposals/portable-sku-service.md)  
**Railway staging:** [`docs/runbooks/sku-api-railway-staging.md`](../runbooks/sku-api-railway-staging.md)

## Packages

| Package | Role |
| --- | --- |
| `packages/sku-core` | Pure domain: normalize, stem, format/parse/validate, preview. No Shopify/Next/Prisma/HTTP. |
| `packages/sku-contract` | Zod `/v1` schemas + typed `createSkuClient`. Consumed by Next via `transpilePackages` (extensionless TS imports — not Node `.js` suffixes). |
| `services/sku-api` | Prisma registry + Postgres/`SkuRegistryStore`, allocator, legacy importer, HTTP `/v1` + auth, Railway config. |

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
pnpm --filter @synarava/sku-api credentials:generate -- synarava-shop
```

Prints `SKU_API_CREDENTIALS` (hashed, for sku-api) and plaintext `SKU_API_TOKEN` (for synarava-web) separately. Local-only fallback: `SKU_API_DEV_TOKEN`.

Synarava server env (never expose to browser): `SKU_API_URL`, `SKU_API_TOKEN`, optional `SKU_API_WORKSPACE` (default `synarava-shop`).

## Bootstrap

On start (unless `SKU_BOOTSTRAP=0`): idempotent ensure of workspace `synarava-shop` + published profile v1.  
**Do not** use `SKU_SEED_EXAMPLE` on staging/production (removed from the runtime path).

## Admin UI

Shared → **SKU policy** (`/admin/settings#shared-sku-policy`): draft/publish profile, read-only assignments + audit. Shows a staging-gate alert when the SKU API env is unset.

## Boundary (unchanged)

- Shopify owns assigned Variant SKU ([ADR-0002](../adr/0002-shopify-catalog-ownership.md)).
- Conflict compare remains normalize + deep-diff ([ADR-0003](../adr/0003-commerce-conflict-deep-diff.md)).
- Этап 3 will wire preview → reserve → Shopify write → read-back → confirm without inventing a second catalog.

## Tests

```bash
pnpm test:sku                                          # unit (memory store)
pnpm --filter @synarava/sku-api test:integration       # real PostgreSQL
```

Postgres integration covers persist-across-reconnect, **parallel same-stem unique sequences**, and concurrent identical idempotency keys. Serializable reserve retries `P2034` / unique races (`P2002`) with a bounded backoff.

## Not done yet

- Synarava product Inventory reserve/confirm flow (Этап 3)
- Shopify staging matrix, n8n, production rollout (Этап 4–6)
