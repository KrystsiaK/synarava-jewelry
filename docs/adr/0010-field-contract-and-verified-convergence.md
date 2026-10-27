# ADR-0010: Field contract metadata + verified convergence

**Date**: 2026-10-27  
**Status**: proposed  
**Deciders**: владелец проекта  
**Depends on**: [ADR-0003](0003-commerce-conflict-deep-diff.md), [ADR-0008](0008-sync-two-state-owner-model.md), [ADR-0009](0009-derive-synarava-commerce-state.md)  
**Accepted when**: sync-reliability PR-6, PR-7, and PR-8 are merged to staging (`field-contract-metadata`, `generated-roundtrip-invariant`, `convergence-archive`).

## Context

Conflict UI routed sections with path/label regex; nested window paths mis-labeled (`amount` instead of Cost); whole-item leaves forced parsing of `Label: value` text; section chips ignored `section` in `selectSyncCounts`; tab dots lit every shared tab from a bare `shared` flag. Writes could be treated as resolved without proving the intended leaf was gone. Destructive collection Remove hard-deleted Synarava rows.

## Decision

1. **ONE declarative field contract** (`lib/sync/field-registry.ts`) per commerce field: stable `contractKey`, Shopify path pattern(s), label, editor `section`, scope, ownership, value type, normalizer id, apply capabilities (`scoped` | `whole-record-only` | `unsupported`). Metadata only — no read/write plans, interpreters, or callbacks in the registry.
2. **Detect stays deepDiff** of derived Shopify-shaped windows (ADR-0003 / ADR-0009). The contract labels and routes leaves; it is not a detect allowlist.
3. **SyncLeaf carries contract metadata**: `contractKey`, `section`, and for `commerce:whole-item` a structured `parts[]`. Display text and translation dedupe read `parts` — never parse formatted values.
4. **ONE selector** (`selectSyncCounts` / `slice`) for every counter (nav, list chip, banner, locale tab, section chip). Section chip filters by leaf/part `section`.
5. **Two autonomy mechanisms**:
   - **Generated contract tests** — path matching, completeness, GraphQL selection coverage, round-trip invariant on the real pull mapper → derive → `compareSyncState` → zero commerce leaves.
   - **Runtime convergence** — after a write batch, exactly one scoped entity waterfall (`recheckEntityConflictLeaves`) proves intended addresses cleared (`converged` | `did_not_converge` | `convergence_unverified`). Destructive Remove archives into `SyncEntityArchive` before delete.

## Alternatives considered

### Caches / `updatedAt` cursors / partial merges as correctness proof
- **Why not**: caches drift; partial merges hide fields; owner forbids them as proof.

### Shopify bulk operations / background workers / second compare
- **Why not**: second mechanism; violates one-compare / one-selector / human Apply rules.

### Third state / queues / automatic Synarava writes
- **Why not**: rejected by ADR-0008.

### Swallow unknown Shopify paths with last-segment labels
- **Why not**: hides contract gaps; unknown non-technical paths become blocked `Unmapped Shopify field <path>` leaves.

## Consequences

- Consumers (nav, chip, banner, locale tab, section modal, labels, whole-item card) read leaf contract metadata only.
- ADR-0010 becomes **Accepted** when PR-6..PR-8 land; until then status stays **proposed**.
- Wiki: [`docs/wiki/commerce-sync.md`](../wiki/commerce-sync.md).
