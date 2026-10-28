# Ranking — all verified findings (Phases 1–5)

**Date:** 2026-10-28 (Europe/Lisbon)  
**Score:** roughly `(severity weight × blast radius) / fix size`  
Weights: critical=4, high=3, medium=2, low=1. Blast: store/money/auth=3, catalog-admin=2, dx/ci=1. Size: XS≈1, S≈2, M≈3, L≈4.

**Do not merge audit PRs as a bundle.** Open **fix** PRs in the order below.

## Recommended fix PR order

| # | Finding ids | One-line fix PR | Size | Owner |
|---|-------------|-----------------|------|-------|
| 1 | AUTH-ADV-001 (+ optionally 002) | `requireAdminSession` on SKU policy (+ getSaved*) | XS–S | admin UI |
| 2 | REL-001 + REL-002 + DEAD-001 | products/reviews → `parseShopifyWebhookJson` + 400 on bad JSON | XS | core/sync |
| 3 | SYNC-ADV-002 | typed `lookupContractForPath(path, resource)` | M | core/sync |
| 4 | PERF-ADV-001 | LCP mobile/PDP (images, priority) | M | storefront |
| 5 | A11Y-ADV-001 | footer wordmark contrast | XS | storefront |
| 6 | SEO-ADV-001 + SEO-ADV-002 | home meta description + PT titles | S | storefront |
| 7 | REL-003 | reject/synthesize missing webhook id | S | core/sync |
| 8 | SYNC-ADV-001 | contractKey/section on translation leaves | S | core/sync |
| 9 | DEAD-005 | shared base64url cursor helper | S | core/sync + storefront |
| 10 | REL-004 | collector lease or Railway concurrency=1 | S | infra |
| 11 | DEAD-007 | replace e2e `waitForTimeout` | S–M | infra |
| 12 | PERF-ADV-002 | trim unused JS / third parties | M | storefront |
| 13 | SYNC-ADV-004 | dedupe `retainedShopifyMediaIds` | XS | core/sync |
| 14 | DEAD-002/003/004 + DEAD-006 | drop unused deps + deprecated aliases | XS–S | admin UI / infra |
| 15 | REL-005 | doc accept or shared throttle bucket | XS or M | infra |
| 16 | REL-006 | additive-or-runbook checklist for new migrations | S | infra |
| 17 | SEO-ADV-003 | confirm **prod** robots/sitemap ≠ staging | XS ops | infra |

REL-007 is a **pass** (runbook paths OK) — no fix PR.

## Full verified table (score descending)

| Rank | Id | Sev | Blast | Size | Score≈ | Fix owner |
|------|----|-----|-------|------|--------|-----------|
| 1 | AUTH-ADV-001 | high | auth | XS | 9 | admin UI |
| 2 | REL-001 | high | catalog ops | XS | 9 | core/sync |
| 3 | REL-002 / DEAD-001 | high | catalog ops | XS | 9 | core/sync |
| 4 | SYNC-ADV-002 | high | catalog-admin | M | 2 | core/sync |
| 5 | AUTH-ADV-002 | medium | auth | XS | 6 | admin UI |
| 6 | PERF-ADV-001 | high* | storefront | M | ~3 | storefront |
| 7 | A11Y-ADV-001 | medium | storefront | XS | 6 | storefront |
| 8 | SEO-ADV-001 | medium | storefront | XS | 6 | storefront |
| 9 | SEO-ADV-002 | medium | storefront | S | 3 | storefront |
| 10 | REL-003 | medium | catalog ops | S | 3 | core/sync |
| 11 | DEAD-005 | medium | dx | S | 2 | core/sync |
| 12 | REL-004 | medium | ops | S | 3 | infra |
| 13 | DEAD-007 | medium | ci | S | 2 | infra |
| 14 | SYNC-ADV-001 | medium | catalog-admin | S | 2 | core/sync |
| 15 | PERF-ADV-002 | medium | storefront | M | 2 | storefront |
| 16 | REL-005 | medium | ops | M/XS | 2–6 | infra |
| 17 | REL-006 | medium | ops policy | S | 3 | infra |
| 18 | SYNC-ADV-004 | low | catalog | XS | 2 | core/sync |
| 19 | DEAD-002/003/004 | low | dx | XS | 1 | admin UI / infra |
| 20 | DEAD-006 | low | dx | S | 1 | various |
| 21 | SEO-ADV-003 | low | ops note | XS | 1 | infra |
| — | REL-007 | low pass | — | — | — | — |

\*PERF severity from measured Lighthouse on staging; treat as high user impact.

## Hypotheses only (do **not** schedule as fix PRs yet)

| Id | Phase | Claim |
|----|-------|-------|
| SYNC-ADV-H1 | 1 | filename collision can bind wrong remote media gid |
| SYNC-ADV-H2 | 1 | whole-record converge success while translation siblings remain |
| AUTH-ADV-H1 | 2 | many actions auth Y / no Zod |
| AUTH-ADV-H2 | 2 | sku-policy familiesJson only JSON.parse |
| AUTH-ADV-H3 | 2 | public cart API manual validation |
| PERF-ADV-H1 | 3 | desktop PDP LCP root cause = hero sizing |
| PERF-ADV-H2 | 3 | real INP needs CrUX/field data |
| DEAD-H1–H4 | 4 | knip unused exports / chart dual exports / tool noise |
| REL-H1–H3 | 5 | collector overlap in prod; missing webhook id in wild; 429 storms |

## Test-only / docs-only fix PRs

Per audit charter: **no src logic fixes in audit PRs.**  
Allowed follow-ups that are still test/docs-only:

- Owner pages + this rank (this PR).
- Extra characterization tests without changing behavior.

**Not** opened here: AUTH/REL/SYNC code fixes (need src) and dep deletions (package.json — open separately after owner ok).

## Audit PR index (do not merge)

| Phase | Branch | PR |
|-------|--------|-----|
| 1 | `cursor/audit-sync-adversarial-p1-34b8` | #358 |
| 2 | `cursor/audit-server-auth-p2-34b8` | #359 |
| 3 | `cursor/audit-storefront-perf-p3-34b8` | #360 |
| 4 | `cursor/audit-dead-code-p4-34b8` | #361 |
| 5 | `cursor/audit-reliability-p5-34b8` | #362 |
| 6 | `cursor/audit-owner-docs-p6-34b8` | (this) |
