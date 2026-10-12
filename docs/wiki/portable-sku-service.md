# Portable SKU service

**Status:** Этап 1–2 implemented · Synarava Shopify adapter (Этап 3+) not yet  
**ADR:** [`docs/adr/0004-portable-sku-service-boundary.md`](../adr/0004-portable-sku-service-boundary.md)  
**Plan:** [`docs/proposals/portable-sku-service.md`](../proposals/portable-sku-service.md)

## Packages

| Package | Role |
| --- | --- |
| `packages/sku-core` | Pure domain: normalize, stem, format/parse/validate, preview. No Shopify/Next/Prisma/HTTP. |
| `packages/sku-contract` | Zod `/v1` schemas + typed `createSkuClient`. |
| `services/sku-api` | Prisma registry schema/migrations, allocator, legacy importer, HTTP `/v1` + auth, Railway stub. |

## HTTP (Этап 2)

- `GET /health` — ready when credentials configured
- `POST /v1/workspaces/{key}/skus/preview|validate`
- `POST /v1/workspaces/{key}/reservations` (+ `Idempotency-Key`)
- `POST /v1/workspaces/{key}/assignments/confirm`
- `POST /v1/workspaces/{key}/assignments/{id}/lock`
- `GET /v1/workspaces/{key}/assignments` · `GET …/audit-events`
- `GET|POST /v1/workspaces/{key}/profiles` · `POST …/profiles/{version}/publish`

Auth: `Authorization: Bearer <token>` scoped to path workspace. Configure `SKU_API_CREDENTIALS=workspace:saltHex:hashHex` (or local `SKU_API_DEV_TOKEN` only).

Synarava server env (never expose to browser): `SKU_API_URL`, `SKU_API_TOKEN`, optional `SKU_API_WORKSPACE` (default `synarava-shop`).

## Admin UI

Shared → **SKU policy** (`/admin/settings#shared-sku-policy`): draft/publish profile, read-only assignments + audit. Shows a staging-gate alert when the SKU API env is unset.

## Boundary (unchanged)

- Shopify owns assigned Variant SKU ([ADR-0002](../adr/0002-shopify-catalog-ownership.md)).
- Conflict compare remains normalize + deep-diff ([ADR-0003](../adr/0003-commerce-conflict-deep-diff.md)).
- Этап 3 will wire preview → reserve → Shopify write → read-back → confirm without inventing a second catalog.

## Tests

```bash
pnpm test:sku
```

## Not done yet

- Prisma Postgres runtime adapter behind `SKU_DATABASE_URL` (schema/migrations exist)
- Synarava product Inventory reserve/confirm flow (Этап 3)
- Shopify staging matrix, n8n, production rollout (Этап 4–6)
