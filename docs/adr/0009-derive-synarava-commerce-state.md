# ADR-0009: Derive Synarava commerce state (drop workingSnapshot)

**Date**: 2026-10-26  
**Status**: accepted  
**Deciders**: владелец проекта  
**Amends**: [ADR-0008](0008-sync-two-state-owner-model.md)

## Context

ADR-0008 fixed “two states, nothing automatic, one compare module” with Synarava commerce stored as `workingSnapshot`. That JSON duplicated Prisma columns, drifted when Save write-through was incomplete, and blocked a single mental model where OUR state is the real records. Orphan Shopify paths (publications, HS code, media GIDs after Pull clears `ProductMedia`, arbitrary metafields) had no column home.

## Decision

1. **Two states only** — Synarava working copy is **derived on the fly** from real columns/tables + `extras` JSON (orphan Shopify-shaped keys) + locale translation rows; Shopify observation remains `shopifySnapshot` / live Translations API. No stored derived OUR commerce window.
2. **Nothing automatic writes Synarava content** — unchanged from ADR-0008.
3. **One compare module** — derive OUR window → `canonicalizeShopifyProjection` + `deepDiff` vs `shopifySnapshot` (ADR-0003). Field registry owns labels, scopes (`base` \| `locale` \| `synaravaOnly`), and apply writers — not a detect allowlist that replaces deepDiff.
4. **`workingSnapshot` is removed** — archived then dropped; column must not be reintroduced.

## Alternatives Considered

### Keep `workingSnapshot` as OUR SoT; columns as UI projections
- **Why not**: duplicate SoT, incomplete write-through, owner rejected.

### Detect by iterating a field registry only (no deepDiff)
- **Why not**: forgets fields (ADR-0003 / shopify-commerce-compare). Registry is presentation + write; detect stays object deepDiff of derived windows.

### Put all orphan paths into new Prisma columns
- **Why not**: media GIDs / publications / arbitrary metafields are open-ended; `extras` is the explicit home.

## Consequences

- **Positive**: one home per field; Save/Apply write columns or `extras`; compare always sees live columns; net code shrinks (no resolve/write-through dual paths).
- **Negative**: derive must stay in lockstep with GraphQL snapshot shape; `extras` must be updated when Apply/Pull copies orphan Shopify fields.
- **Risks**: migrate without verifying derive ≡ archived window → false conflicts. Mitigate with `scripts/db/verify-derived-window.mjs` before merge.
