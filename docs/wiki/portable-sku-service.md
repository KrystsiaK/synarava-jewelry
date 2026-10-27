# Portable SKU service

**Status:** Этап 1–5 shipped · production platform healthy · controlled Draft-product SKU pilot passed · production n8n remains inactive until the live-Shopify audit workflow is verified
**ADR:** [`docs/adr/0004-portable-sku-service-boundary.md`](../adr/0004-portable-sku-service-boundary.md)
**Plan:** [`docs/proposals/portable-sku-service.md`](../proposals/portable-sku-service.md)
**Staging matrix:** [`docs/testing/portable-sku-staging-matrix.md`](../testing/portable-sku-staging-matrix.md)
**Railway staging:** [`docs/runbooks/sku-api-railway-staging.md`](../runbooks/sku-api-railway-staging.md)
**Catalog audit:** [`docs/runbooks/sku-catalog-audit-staging.md`](../runbooks/sku-catalog-audit-staging.md)
**Current status (agent handoff):** [`docs/runbooks/portable-sku-current-status.md`](../runbooks/portable-sku-current-status.md)
**Platform Railway:** [`docs/runbooks/portable-sku-platform-railway.md`](../runbooks/portable-sku-platform-railway.md)

## Packages

| Package | Role |
| --- | --- |
| `packages/sku-core` | Pure domain: normalize, stem, format/parse/validate, preview. No Shopify/Next/Prisma/HTTP. |
| `packages/sku-contract` | Zod `/v1` schemas + typed `createSkuClient`. Consumed by Next via `transpilePackages` (extensionless TS imports — not Node `.js` suffixes). |
| `services/sku-api` | Prisma registry + Postgres/`SkuRegistryStore`, allocator, legacy importer, HTTP `/v1` + auth + rate limit. Railway: `portable-sku-platform` (ID `6d7d5885-43eb-4283-b4a4-e552fc6dba7b`). |

## Persistence

| Condition | Store |
| --- | --- |
| `SKU_DATABASE_URL` set | Prisma PostgreSQL (`createPrismaSkuRegistryStore`) — staging/production |
| unset | In-memory serializable store — unit tests / local without DB |

Factory: `createSkuStoreRuntime()` in `services/sku-api/src/registry/create-store.ts`.

## HTTP (Этап 2)

- `GET /health` — ready when credentials configured **and** DB reachable (Postgres mode); body includes `store`
- `POST /v1/workspaces/{key}/skus/preview|validate`
- `POST /v1/workspaces/{key}/audit/catalog` — read-only batch compare (Этап 5 Slice A); staging n8n schedule (Slice B) in [`sku-catalog-audit-staging.md`](../runbooks/sku-catalog-audit-staging.md) — **smoke Pass** (first **Telegram** notify, later silent)
- `POST /v1/workspaces/{key}/legacy-backfill` — authenticated, digest-gated cutover of pre-existing Shopify SKU values. `dry-run` reports create/existing/conflict counts and a stable digest; `apply` requires that reviewed digest. Existing SKU strings are stored verbatim as `LEGACY_V0` exceptions and are not validated against policy v1.
- `POST /v1/workspaces/{key}/reservations` (+ `Idempotency-Key`)
- `POST /v1/workspaces/{key}/assignments/confirm`
- `POST /v1/workspaces/{key}/assignments/{id}/lock`
- `GET /v1/workspaces/{key}/assignments` · `GET …/audit-events`
- `GET|POST /v1/workspaces/{key}/profiles` · `POST …/profiles/{version}/publish`

Auth: `Authorization: Bearer <token>` scoped to path workspace.

Synarava web also exposes protected `GET /api/ops/sku-catalog` to the audit workflow. It uses the same service Bearer, paginates the live Shopify Admin `productVariants` connection, and returns a complete normalized `{ externalVariantId, sku }` snapshot (max 5,000). Shopify credentials never leave Synarava web; any incomplete upstream read fails the workflow instead of auditing a partial catalog.

```bash
node services/sku-api/scripts/generate-credentials.mjs synarava-shop
```

Prints `SKU_API_CREDENTIALS` (hashed, for sku-api) and plaintext `SKU_API_TOKEN` (for synarava-web) separately. Local-only fallback: `SKU_API_DEV_TOKEN`.

Railway staging: [`docs/runbooks/sku-api-railway-staging.md`](../runbooks/sku-api-railway-staging.md) — web CaC at `deploy/railway.synarava-web.json`; sku-api via IaC (Config as Code deprecated for new services).

Synarava server env (never expose to browser): `SKU_API_URL` (**HTTPS** public sku-api host — not a cross-project private `${{sku-api.*}}` ref), `SKU_API_TOKEN`, optional `SKU_API_WORKSPACE` (default `synarava-shop`).

## Bootstrap

On start (unless `SKU_BOOTSTRAP=0`): idempotent ensure of workspace `synarava-shop` + published profile v1.
**Do not** use `SKU_SEED_EXAMPLE` on staging/production (removed from the runtime path).

## Legacy cutover invariant

Every non-empty SKU that already exists in Shopify at cutover is preserved
verbatim as a `LEGACY_V0` assignment. It is not renamed, normalized, or rejected
by the current policy. If its suffix can be parsed, the corresponding sequence is
tombstoned so the allocator cannot reissue it. Matching legacy assignments are
also exempt from `INVALID_FORMAT` audit deviations. Only SKUs created after the
cutover use the published allocation policy.

## Admin UI

Shared → **SKU policy** (`/admin/settings#shared-sku-policy`): draft/publish profile, read-only assignments + audit. Shows a staging-gate alert when the SKU API env is unset.

Product → **Inventory**: when sku-api is configured, each local variant row uses Preview / Confirm assign (`ProductSkuAssignPanel`). Linked variants run reserve → Shopify write → read-back → confirm. Unlinked variants reserve locally; the persistent header action remains **Create in Shopify**, whose push writes the SKU and confirms the reservation. **Retry confirm** is shown only for a linked variant, where resuming the existing reservation is a valid idempotent action.

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
- Kiryl confirm → staging IaC apply on `portable-sku-platform` after safe adoption `plan` (adopt sku-*; create staging n8n+n8n-postgres; no prod)
- `EXTERNAL_CHANGE_DETECTED` · recovery-queue automation
- Этап 6 production rollout (prep docs/IaC: [`portable-sku-platform-production.md`](../runbooks/portable-sku-platform-production.md); apply gated)
- Manual matrix rows M6 / M9–M11 / M13 (M2 Pass Kiryl 2026-10-13; M3/M4/M5/M7/M8/M12 auto; Этап 5 n8n smoke Pass)

