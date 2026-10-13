# Portable SKU — Shopify staging matrix (Этап 4)

**Status:** matrix ready for Kiryl runs on staging · code on `staging` after Этап 4 land  
**ADR:** [`docs/adr/0004-portable-sku-service-boundary.md`](../adr/0004-portable-sku-service-boundary.md)  
**Plan:** [`docs/proposals/portable-sku-service.md`](../proposals/portable-sku-service.md) § Этап 4  
**Wiki:** [`docs/wiki/portable-sku-service.md`](../wiki/portable-sku-service.md)

Production and n8n are **out of scope**. Do not merge SKU work to `main` via PR #148.

## Preconditions

| Check | Expected |
| --- | --- |
| sku-api in **synarava-shop / staging** | `GET /health` ok |
| Web env | `SKU_API_URL`, `SKU_API_TOKEN`, `SKU_API_WORKSPACE=synarava-shop` |
| Published profile v1 | families include e.g. `jewelry.necklace` |
| Shopify Admin on staging store | Admin GraphQL write for variant SKU |

## Automated coverage (Vitest)

| Scenario | Test anchor |
| --- | --- |
| Linked assign → write → confirm | `lib/sku/__tests__/assign-variant-sku.test.ts` |
| Unlinked reserve → pending map | same |
| Idempotent resume (pending + Shopify already has SKU) | `resumes pending instead of reserving again` |
| Resume writes when Shopify empty/different | `resumePendingSkuAssignment` |
| Per-variant assign by `variantId` | `assigns a non-primary variant by variantId` |
| Legacy + map pending shapes | `lib/sku/__tests__/pending-reservation.test.ts` |

## Manual staging matrix

Fill **Result** / **Evidence** after each run (screenshot, assignment id, Shopify GID, correlationId).

| # | Scenario | Steps | Expected | Result | Evidence |
| --- | --- | --- | --- | --- | --- |
| M1 | **Unlinked** reserve → Push → confirm | Create draft → Inventory Preview/Confirm assign → Push | SKU in Shopify; pending cleared; ledger assignment active | Pass (Kiryl 2026-10-13) | Этап 3 check |
| M2 | **Linked** assign | Product already linked (product+variant GIDs) → Inventory Confirm assign | reserve → Shopify write → read-back → confirm in one action; no pending left | | |
| M3 | **Idempotent retry** after pending | Force pending (e.g. interrupt confirm) → **Retry confirm** | No new reservation; same SKU confirmed; ledger ok | | |
| M4 | Double Confirm assign (same family) | Assign succeeds → Confirm assign again | Blocked: “already has SKU…”; no second sequence | | |
| M5 | Same idempotency key | Two rapid Confirm assign (same variant+family) before first finishes | One SKU; sku-api returns same reservation | | |
| M6 | **Multi-variant** (linked) | Product with ≥2 variants, both pending → assign each row | Distinct SKUs per variant; primary mirrors `Product.sku` | | |
| M7 | Parallel same family (two variants) | Assign variant A and B (same family) close together | Distinct sequences (different idempotency keys) | | |
| M8 | Empty / invent blocked | Push with `PENDING-*` and no reservation | Push error: assign first | | |
| M9 | External Shopify SKU edit | Change Variant SKU in Shopify Admin → Pull/conflict | Conflict shows Variant SKU; no silent overwrite; assign refuses second reserve | | |
| M10 | Duplicate Shopify product | Duplicate in Shopify → pull/create local | New variants need new assign; old assignments stay on original GIDs | | |
| M11 | Publish + order lock (smoke) | Publish product; place test order if policy requires | SKU unchanged on publish; lock policy per profile (may be N/A until lock UI) | | |
| M12 | sku-api unavailable | Stop/break `SKU_API_URL` briefly during Push with pending | Push fails visibly; pending retained | | |
| M13 | Ledger vs Shopify vs local | After M1/M2: Settings → Assignments + Shopify Admin + Synarava Inventory | Same SKU string; external ids match | | |

## Recovery notes

- **Retry confirm** (`resumePendingSkuAction`): read Shopify → write reserved SKU if missing/mismatch → confirm. Never calls `reserve` again.
- Confirm-on-push still runs for unlinked path after `productVariantsBulkUpdate` read-back.
- Pending storage: `Product.details.skuAssignmentPendings[variantId]` (legacy `skuAssignmentPending` still readable).

## Out of scope (Этап 5–6)

- n8n audit/recovery workflows  
- Production rollout / feature flag  
- Merge to `main`
