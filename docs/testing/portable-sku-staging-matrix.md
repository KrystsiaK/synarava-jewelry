# Portable SKU — Shopify staging matrix (Этап 4)

**Status:** M1 Pass · M2 Fail→fix (empty Pull invent) · M3/M4/M5/M7/M8/M12 Pass (auto)  
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
| **M3** Idempotent resume / Retry confirm (no second reserve) | `lib/sku/__tests__/staging-matrix-automation.test.ts` |
| **M4** Double Confirm blocked | same |
| **M5** Parallel same idempotency key → one SKU | same (+ `services/sku-api` allocator / pg idempotency) |
| **M7** Parallel variants → distinct SKUs | same |
| **M8** PENDING without reservation blocks Push | `lib/sku/__tests__/push-sku-gate.test.ts` + matrix automation |
| **M12** sku-api unavailable keeps pending + clear error | same |
| **M2** Pull empty SKU → linked assign | `lib/sku/__tests__/m2-linked-empty-sku.test.ts` |
| Resume writes when Shopify empty/different | `resumePendingSkuAssignment` in assign-variant-sku tests |
| Per-variant assign by `variantId` | assign-variant-sku tests |
| Legacy + map pending shapes | `lib/sku/__tests__/pending-reservation.test.ts` |

Run:

```bash
pnpm exec vitest run lib/sku/__tests__/staging-matrix-automation.test.ts lib/sku/__tests__/push-sku-gate.test.ts
pnpm test:run
```

## Manual staging matrix

Fill **Result** / **Evidence** after each run (screenshot, assignment id, Shopify GID, correlationId).

| # | Scenario | Steps | Expected | Result | Evidence |
| --- | --- | --- | --- | --- | --- |
| M1 | **Unlinked** reserve → Push → confirm | Create draft → Inventory Preview/Confirm assign → Push | SKU in Shopify; pending cleared; ledger assignment active | Pass (Kiryl 2026-10-13) | Этап 3 check |
| M2 | **Linked** assign | Product already linked (product+variant GIDs) → Inventory Confirm assign | reserve → Shopify write → read-back → confirm in one action; no pending left | **Fail→fix** (Kiryl 2026-10-13): Pull empty SKU invented `SHOPIFY-*` and blocked assign. Fix: invent `PENDING-p{product}-v{variant}`; treat legacy `SHOPIFY-*` as assignable. | `lib/sku/__tests__/m2-linked-empty-sku.test.ts` (full linked flow + legacy SHOPIFY-*); `localSkuForEmptyShopifySku` in pull (`product-sync.ts`). Re-verify on staging after land. |
| M3 | **Idempotent retry** after pending | Force pending (e.g. interrupt confirm) → **Retry confirm** | No new reservation; same SKU confirmed; ledger ok | **Pass (auto)** | `staging-matrix-automation.test.ts` → `M3: Retry confirm / resume does not create a second reserve` (`reserve` not called; `resumed: true`) |
| M4 | Double Confirm assign (same family) | Assign succeeds → Confirm assign again | Blocked: “already has SKU…”; no second sequence | **Pass (auto)** | `M4: second Confirm assign after success is blocked` — error matches `/already has SKU/i`; `reserve` not called |
| M5 | Same idempotency key | Two rapid Confirm assign (same variant+family) before first finishes | One SKU; sku-api returns same reservation | **Pass (auto)** | `M5: parallel Confirm with same idempotency key yields one SKU` — both `JW-NECK-001`, single key `sku-assign:p1:var-1:jewelry.necklace`; ledger: `allocator.test.ts` / pg `concurrent identical idempotency keys` |
| M6 | **Multi-variant** (linked) | Product with ≥2 variants, both pending → assign each row | Distinct SKUs per variant; primary mirrors `Product.sku` | | Manual / follow-up |
| M7 | Parallel same family (two variants) | Assign variant A and B (same family) close together | Distinct sequences (different idempotency keys) | **Pass (auto)** | `M7: parallel assign on two variants` — distinct SKUs; keys `…:var-a:…` vs `…:var-b:…` |
| M8 | Empty / invent blocked | Push with `PENDING-*` and no reservation | Push error: assign first | **Pass (auto)** | `assertSkuAssignableBeforePush` → `PUSH_SKU_UNASSIGNED_ERROR`; wired in `pushProductToShopify` via `lib/sku/push-sku-gate.ts` |
| M9 | External Shopify SKU edit | Change Variant SKU in Shopify Admin → Pull/conflict | Conflict shows Variant SKU; no silent overwrite; assign refuses second reserve | | Manual |
| M10 | Duplicate Shopify product | Duplicate in Shopify → pull/create local | New variants need new assign; old assignments stay on original GIDs | | Manual |
| M11 | Publish + order lock (smoke) | Publish product; place test order if policy requires | SKU unchanged on publish; lock policy per profile (may be N/A until lock UI) | | Manual |
| M12 | sku-api unavailable | Stop/break `SKU_API_URL` briefly during Push with pending | Push fails visibly; pending retained | **Pass (auto)** | `requireSkuClientForPendingConfirm(null)` → `PUSH_SKU_CLIENT_MISSING_ERROR`; confirm failure path does **not** call `persistLocalSku` (pending retained) |
| M13 | Ledger vs Shopify vs local | After M1/M2: Settings → Assignments + Shopify Admin + Synarava Inventory | Same SKU string; external ids match | | Manual after M2 |

## Recovery notes

- **Retry confirm** (`resumePendingSkuAction`): read Shopify → write reserved SKU if missing/mismatch → confirm. Never calls `reserve` again.
- Confirm-on-push still runs for unlinked path after `productVariantsBulkUpdate` read-back.
- Pending storage: `Product.details.skuAssignmentPendings[variantId]` (legacy `skuAssignmentPending` still readable).
- Push gate helpers: `lib/sku/push-sku-gate.ts` (`assertSkuAssignableBeforePush`, `requireSkuClientForPendingConfirm`).

## Out of scope (Этап 5–6)

- n8n audit/recovery workflows  
- Production rollout / feature flag  
- Merge to `main`
