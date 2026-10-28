# Audit — Reliability of background / ops paths (Phase 5)

**Date:** 2026-10-28 (Europe/Lisbon)  
**Mode:** report + inventory locks only (no production behavior changes)  
**Base:** `staging`  
**Do not merge without owner.**  
**Staging follow-up:** REL-001/002 (safe webhook JSON), REL-008 (orders topics), REL-009 (`AbortSignal.timeout`), REL-010 (Railway cleanup cron runbook) are addressed on current `staging`; inventory locks below track the fixed state.

## Scope

- Mission Control collector cron
- Shopify webhooks (signature, idempotency, retries, parse)
- Shopify Admin throttle retry
- sku-api failure modes
- Prisma migration additivity
- Backup / restore runbook vs `scripts/db*`

## Verified findings

### REL-001 — Products webhook: uncaught `JSON.parse` on bad body

| | |
|---|---|
| **Severity** | high |
| **Evidence** | `app/api/shopify/webhooks/products/route.ts` L25: `JSON.parse(rawBody)` outside try/catch. Malformed JSON throws before claim; Next returns 500 → Shopify retries indefinitely. Contrast: `reviews/route.ts` L30–34 catches parse errors → **400**. Orders family uses `parseShopifyWebhookJson` inside try → 400. Test: `adversarial-reliability.inventory.test.ts` → `it.fails(... REL-001)`. |
| **Proposed minimal fix** | Wrap parse (prefer `parseShopifyWebhookJson`) in try/catch; return 400 on invalid JSON. Same PR can close DEAD-001. |
| **Estimated size** | XS |
| **Fix owner** | core/sync |

### REL-002 — Products/reviews skip safe 64-bit id parser

| | |
|---|---|
| **Severity** | high |
| **Evidence** | Same as DEAD-001 (`docs/audits/2026-10-28-dead-code.md`): products L25 + reviews L31 use raw `JSON.parse`; orders/refunds/returns use `lib/shopify/webhook-json.ts`. Unsafe integer ids can round before `shopifyNumericId` / claim payload persist. |
| **Proposed minimal fix** | Switch both routes to `parseShopifyWebhookJson` (pairs with REL-001). |
| **Estimated size** | XS |
| **Fix owner** | core/sync |

### REL-003 — Webhook idempotency requires `x-shopify-webhook-id`

| | |
|---|---|
| **Severity** | medium |
| **Evidence** | `lib/shopify/webhook-event.ts` L26–41: first path always `create`. On unique conflict, reclaim only runs when `params.webhookId` is truthy (L39). If header is null/missing, every delivery inserts a new `ProductSyncEvent` (`shopifyWebhookId String? @unique` — Postgres treats NULLs as distinct). Products/reviews pass `request.headers.get("x-shopify-webhook-id")` through without rejecting null. |
| **Proposed minimal fix** | Reject missing webhook id with 400 (or synthetic id from topic+payload hash) before claim; document Shopify guarantee in runbook. |
| **Estimated size** | S |
| **Fix owner** | core/sync |

### REL-004 — Collector cron has no lease / single-flight

| | |
|---|---|
| **Severity** | medium |
| **Evidence** | `runCollectorOnce` (`lib/mission-control/collector/run-once.ts` L85–91) probes + upserts with no DB lease. `runCollectorProcess` (`entry.ts` L19–42) runs once and exits — no lock against an overlapping tick. Catalog reconcile **does** lease (`CATALOG_CHECK_LEASE_MS` in `lib/shopify/reconciliation-run.ts` L208). Collector does not. |
| **Proposed minimal fix** | Advisory lock or `ServiceNodeStatus` heartbeat lease before probes; skip tick if previous still RUNNING; or configure Railway cron `max retries`/concurrency = 1 and document. |
| **Estimated size** | S–M |
| **Fix owner** | infra |

### REL-005 — Shopify throttle pacing is process-local only

| | |
|---|---|
| **Severity** | medium |
| **Evidence** | `lib/shopify/admin.ts` L45–47 comment: “in-process pacing only (no cross-process state)”. Module `lastThrottleStatus` / `paceForThrottleBudget` L62–75. Retries capped: `SHOPIFY_THROTTLE_MAX_ATTEMPTS = 5`, `SHOPIFY_THROTTLE_MAX_TOTAL_WAIT_MS = 30_000` (`admin-telemetry.ts` L54–56). Multi-instance web/admin can stampede the same store bucket. |
| **Proposed minimal fix** | Accept as known limit for single-instance staging; for multi-replica prod, shared token-bucket (Redis) or serialize heavy sync on one worker. |
| **Estimated size** | M (shared bucket) or XS (doc-only acceptance) |
| **Fix owner** | infra / core/sync |

### REL-006 — Prisma history is **not** additive-only

| | |
|---|---|
| **Severity** | medium (policy / release risk) |
| **Evidence** | Multiple applied migrations DROP data/schema, e.g. `20261026160000_derive_synarava_extras_drop_working_snapshot` drops `workingSnapshot` (L114–115 after archive); `20261025214900_archive_and_drop_en_translation_rows` DELETE en translation rows; `20261024100000_drop_commerce_sync_store` DROP TABLE; `20261023230000_drop_sync_third_state_snapshots` DROP columns/table; older `20260924221500_drop_legacy_local_commerce` CASCADE drops. sku-api migrations: init only (additive). |
| **Proposed minimal fix** | Codify gate: new migrations must be additive **or** ship with cutover runbook + archive + verify script (pattern of `derive-synarava-state-release.md`). Add CI comment/checklist — not a blanket ban on historical drops. |
| **Estimated size** | S (policy + checklist) |
| **Fix owner** | infra |

### REL-007 — Backup/restore runbook paths match repo (positive)

| | |
|---|---|
| **Severity** | low (informational / pass) |
| **Evidence** | `docs/runbooks/database-incident-recovery.md` cites `scripts/db-guard.mjs` (exists). Companion runbooks cite `scripts/db/verify-derived-window.mjs`, `rollback-working-snapshot.sql`, `rollback-en-translation-rows.sql`, `restore-entity-archive.sql`, `prod-readiness-check.sql`, `drop-archives.sql.commented` — all present under `scripts/db/`. Spot-check: no missing script paths in those runbooks. |
| **Proposed minimal fix** | None required; keep paths in sync when renaming. |
| **Estimated size** | — |
| **Fix owner** | infra |

### REL-008 — Mission Control orders counters query wrong topic strings

| | |
|---|---|
| **Severity** | high |
| **Evidence** | `lib/mission-control/providers/orders.ts` L39–44 counts `ShopifyWebhookDelivery` with `topic: "ORDERS_PAID"` / `"ORDERS_CANCELLED"`. Webhook routes persist REST header topics: `orders/paid` (`app/api/shopify/webhooks/orders/paid/route.ts` L54–55, test L42/L88) and `orders/cancelled` (`orders/cancelled/route.ts` L46). Successful deliveries never match → `paid`/`cancelled` stay 0; hub can paint `down` when any recent failures exist with zero “successes”. Existing `orders.test.ts` mocks counts and never asserts the `where.topic` filter. Test: `it.fails(... REL-008)`. |
| **Proposed minimal fix** | Query `orders/paid` and `orders/cancelled` (or normalize to one canonical form at claim + provider). Add assertion on `count` args in provider tests. |
| **Estimated size** | XS |
| **Fix owner** | admin UI / infra (Mission Control) |

### REL-009 — SKU HTTP client has no request timeout

| | |
|---|---|
| **Severity** | medium |
| **Evidence** | `packages/sku-contract/src/client.ts` `fetch` path has no `AbortSignal` / timeout (grep: zero matches). Admin assign waits on hung sku-api indefinitely. |
| **Proposed minimal fix** | `AbortSignal.timeout(ms)` (or AbortController) on client fetch; surface timeout as typed error. |
| **Estimated size** | S |
| **Fix owner** | core/sync |

### REL-010 — Sync-history cleanup is opportunistic only

| | |
|---|---|
| **Severity** | medium |
| **Evidence** | `lib/shopify/sync-history-retention.ts` L162–165: “No platform cron… call opportunistically from the catalog check”. Idle periods grow `ProductSyncEvent` / delivery tables. Script `scripts/db/cleanup-sync-history.mjs` exists but is not scheduled. |
| **Proposed minimal fix** | Railway cron to run cleanup script, or collector tick best-effort cleanup. |
| **Estimated size** | S |
| **Fix owner** | infra |

## sku-api failure modes (characterization — no new finding id)

| Mode | Evidence | Behavior |
|------|----------|----------|
| Auth | `services/sku-api/src/auth.ts` + server pre/post auth | 401 |
| Rate limit | `http/rate-limit.ts` fixed window; `server.ts` `retry-after` | 429 |
| Serializable races | `registry/retry.ts` `SERIALIZABLE_RETRY_ATTEMPTS = 12` | bounded retry then throw |
| Domain errors | `registry/errors.ts` | not retried (`retry.test.ts`) |

No verified bug in these paths during this pass; coverage exists in unit tests.

## Webhook matrix (verified)

| Route | Signature | Idempotency | Parse | Fail → Shopify retry |
|-------|-----------|-------------|-------|----------------------|
| products | HMAC 401 | `claimWebhookEvent` | raw JSON **no try** | 500 on process fail; uncaught parse → 500 |
| reviews | HMAC 401 | `claimWebhookEvent` | raw JSON try→400 | 500 on process fail |
| orders/paid | HMAC 401 | `claimOrdersPaidDelivery` | safe parse try→400 | 500 on process fail |
| orders/cancelled | HMAC 401 | `claimOrderLifecycleDelivery` | safe parse | 500 on fail |
| refunds/create | HMAC 401 | lifecycle claim | safe parse | 500 on fail |
| returns/request | HMAC 401 | lifecycle claim | safe parse | 500 on fail |

Processing failures correctly return **500** so Shopify retries; SUCCEEDED rows short-circuit duplicates via claim.

## Hypotheses (unverified)

| Id | Claim | Why unverified |
|----|-------|----------------|
| REL-H1 | Staging/prod Railway collector cron can overlap in practice | Need Railway schedule + duration metrics; code lacks lock but ops may serialize. |
| REL-H2 | Shopify omits `x-shopify-webhook-id` on some topics in the wild | Not reproduced; header present in existing route tests. |
| REL-H3 | Multi-replica throttle stampede has caused production 429 storms | Telemetry exists; no incident log pulled in this audit. |
| REL-H4 | n8n SKU audit workflow has no `retryOnFail` → silent daily miss until next cron | Workflow JSON inspected by secondary pass; not reproduced against live n8n. |
| REL-H5 | sku-api in-memory rate limits under-count across Railway replicas | Same pattern as REL-005; no multi-replica proof. |

## Passing locks

| Lock | Test |
|------|------|
| products route safe parse + 400 (REL-001) | passing |
| MC orders provider topic strings match webhook storage (REL-008) | passing |
| orders/paid uses safe parse + 400 on bad JSON | passing |
| claimWebhookEvent reclaim requires webhookId | passing |
| collector entry has no lease API call | passing |
| throttle constants + in-process comment present | passing |
| cited `scripts/db*` paths exist | passing |
| sku-contract client AbortSignal timeout (REL-009) | passing |
| sync-history cleanup cron runbook + opportunistic default (REL-010) | passing |
