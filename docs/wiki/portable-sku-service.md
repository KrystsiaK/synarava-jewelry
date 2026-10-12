# Portable SKU service

**Status:** Этап 1 (domain POC) implemented · HTTP/admin (Этап 2+) not yet  
**ADR:** [`docs/adr/0004-portable-sku-service-boundary.md`](../adr/0004-portable-sku-service-boundary.md)  
**Plan:** [`docs/proposals/portable-sku-service.md`](../proposals/portable-sku-service.md)

## What exists in the repo now

| Package | Role |
| --- | --- |
| `packages/sku-core` | Pure domain: normalize, stem resolve, format/parse/validate, preview. No Shopify/Next/Prisma/HTTP imports. |
| `packages/sku-contract` | Zod schemas for future `/v1` request/response + error codes. |
| `services/sku-api` | SKU registry Prisma schema + migrations, transactional allocator API (store interface), in-memory store for tests, idempotent legacy importer + safe fixtures. |

pnpm workspace members: `packages/*`, `services/*` (see root `pnpm-workspace.yaml`). Root Synarava app stays at repository root.

## Boundary (unchanged)

- Shopify owns the assigned Variant SKU ([ADR-0002](../adr/0002-shopify-catalog-ownership.md)).
- Conflict compare remains normalize + deep-diff ([ADR-0003](../adr/0003-commerce-conflict-deep-diff.md)).
- SKU service owns policy profiles, reservations, assignments, tombstones, audit — not the product catalog.
- Synarava will call the service over HTTP (Этап 2+) and perform Shopify write + read-back before `assignments/confirm` (Этап 3). No Shopify mutations in Этап 1.

## Running tests

```bash
pnpm test:sku
# or full suite including Synarava:
pnpm test:run
```

Concurrency and idempotency tests use the in-memory serializable registry (no Docker required). Production persistence is PostgreSQL via `SKU_DATABASE_URL` against `services/sku-api/prisma`.

Verified locally: `pnpm test:sku` — 24 tests green (sku-core 15, sku-contract 3, sku-api 6).

## Legacy import

- Safe fixture: `services/sku-api/fixtures/legacy-v0-sample.json`
- Canonical 49-row Synarava export is an **ops input**, not committed. Dry-run / staging import waits for that file and expected counts (proposal §2).

## Not implemented yet

- HTTP `/v1` endpoints, auth middleware, `/health` readiness (Этап 2)
- Synarava Admin profile UI / Inventory SKU UX (Этап 2–3)
- Shopify staging matrix, n8n, production rollout (Этап 4–6) — blocked on staging gates
