# Audit — Sync core adversarial invariants (Phase 1)

**Date:** 2026-10-28 (Europe/Lisbon)  
**Mode:** tests + report only (no production behavior changes)  
**Base:** `staging`  
**PR:** tests under `lib/sync/__tests__/adversarial-*`, `lib/shopify/__tests__/adversarial-*`, `lib/products/__tests__/adversarial-*`  
**Do not merge without owner.**

## Scope

Property / invariant tests for:

- `compareSyncState` determinism + window-order independence
- Take → Keep round-trip via aligned windows → zero commerce leaves
- Field-registry paths ↔ `lookupContractForPath` / equal windows → zero diffs
- Counters (`selectSyncCounts`) === leaf counts
- Contract metadata on leaves
- Cost never in linked push; multi-variant Keep ours blocked
- Stale fingerprint helper rejection
- Convergence gate never succeeds while intended leaf remains
- productSet media gid uniqueness; gallery GID retention

## Verified findings

### SYNC-ADV-001 — Translation leaves lack `contractKey` / `section`

| | |
|---|---|
| **Severity** | medium |
| **Evidence** | `lib/sync/compare.ts` translation leaf builder (~L407–425) omits `contractKey` and `section`. Test: `adversarial-compare-invariants.test.ts` → `it.fails("translation leaves expose contractKey and section (SYNC-ADV-001)")`. |
| **Proposed minimal fix** | When emitting translation leaves, set `contractKey` / `section` from a small translation contract table (or mark `contractKey: "translation"` + section `essentials`) so ADR-0010 “SyncLeaf carries contract metadata” holds for all kinds. |
| **Estimated size** | S (compare + 1 registry table + tests) |
| **Fix owner** | core/sync |

### SYNC-ADV-002 — Collection window paths resolve to product contractKeys

| | |
|---|---|
| **Severity** | high |
| **Evidence** | `lookupContractForPath` (`lib/sync/field-registry.ts` L347–350) searches `PRODUCT_COMMERCE_FIELDS` first. Shared paths (`title`, `handle`, `descriptionHtml`, `seo.title`, `seo.description`) return product `contractKey` (`title`) instead of `collection.title`. Test: `adversarial-field-registry-roundtrip.test.ts` → `it.fails(... SYNC-ADV-002)`. |
| **Proposed minimal fix** | Pass resource type into lookup (`lookupContractForPath(path, "PRODUCT" \| "COLLECTION")`) at all call sites in compare/labeling, or prefix collection window paths. Prefer typed lookup — no path allowlists for detect. |
| **Estimated size** | M (API change + call sites + tests) |
| **Fix owner** | core/sync |

### SYNC-ADV-004 — `retainedShopifyMediaIds` does not dedupe

| | |
|---|---|
| **Severity** | low |
| **Evidence** | `lib/shopify/product-media-alt-form.ts` L74–80 flatMaps gids with no `Set`. Duplicate `extras.media` entries yield duplicate ids. Test: `adversarial-gallery-invariants.test.ts` → `it.fails(... SYNC-ADV-004)`. Push path separately dedupes via `seenMediaIds` (verified passing test). |
| **Proposed minimal fix** | `return [...new Set(ids)]` (or push into a Set while scanning). |
| **Estimated size** | XS |
| **Fix owner** | core/sync |

## Passing invariants (locked by new tests)

| Invariant | Test file |
|-----------|-----------|
| Deterministic fingerprints for identical inputs | `adversarial-compare-invariants` |
| `commerceWindows` array order does not change leaf set | same |
| Media re-host (new gid/url, same filename+alt+position) → 0 leaves | same |
| Media position swap → conflict (position is identity) | same |
| Counters === leaves | same |
| Take then Keep window alignment → 0 commerce leaves | same |
| Multi-variant whole-item / push block Keep ours | compare + `adversarial-push-gates` |
| Linked push omits cost / productSet omits variants | `adversarial-push-gates` |
| productSet files unique gids when extras repeats a gid | same |
| Equal product/collection windows → 0 commerce leaves | `adversarial-field-registry-roundtrip` |
| Product registry paths resolve to their contractKeys | same |
| Convergence / gate fail while intended leaf remains | `adversarial-convergence-gate` |
| Stale fingerprint helper rejects drift | `adversarial-stale-fingerprint` |
| Gallery reorder keeps Shopify gids | `adversarial-gallery-invariants` |

## Hypotheses (unverified — do not treat as findings)

| Id | Claim | Why unverified |
|----|-------|----------------|
| SYNC-ADV-H1 | `remoteByFilename` Map last-wins can bind a local asset to the wrong remote gid when two READY remotes share a filename | With `extras.media` listing both gids, productSet still retains both (passing characterization). Need a fixture where OUR gallery correlates only by filename without listing both gids and proves an unintended delete. |
| SYNC-ADV-H2 | Whole-record Push/Pull with `leavesBefore: []` can mark success while translation siblings remain (`unrelated_new_leaves` → resolved) | By design in `convergence.ts` comments; needs owner product decision whether whole-record should include siblings in `leavesBefore`. |

## Out of scope this PR

No src / prisma / CI / secret changes. Fix PRs must be separate.
