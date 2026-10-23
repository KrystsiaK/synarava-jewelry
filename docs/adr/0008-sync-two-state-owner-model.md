# ADR-0008: Sync — two states, nothing automatic, one module

**Date**: 2026-10-23
**Status**: accepted
**Deciders**: владелец проекта

## Context

Shopify ↔ Synarava sync accumulated a third “common ancestor” state (`shopifyBaseSnapshot`, `ShopifyTranslationSnapshot`, `lastSyncedSnapshot`), automatic Synarava overwrites from webhooks/pull/inspect, and parallel compare/UI paths. That made conflict resolution unpredictable and hard to reason about. The owner model is recorded in [`docs/proposals/sync-unification.md`](../proposals/sync-unification.md).

## Decision

1. **Two states only** — Synarava working copy (`workingSnapshot` / locale translation rows) and Shopify observation (`shopifySnapshot` / live Translations API). No base / ancestor window.
2. **Nothing automatic writes Synarava content** — refresh/webhook/read paths may update Shopify-side snapshots and conflict flags only; humans Apply (or Save write-through).
3. **One compare module** — commerce: `canonicalizeShopifyProjection` + `diffShopifyProjections` (ADR-0003); translations: the same two-way reconcile planner. One conflict UI spine (preview → apply).

## Alternatives Considered

### Keep three-way merge with persisted base
- **Why not**: silent drift, duplicate writers, and “who won?” ambiguity; already proven harmful in production sync bugs.

### Auto-apply Shopify on webhook / inspect
- **Why not**: overwrites editorial Synarava state without a human decision; violates the Owner model.

## Consequences

- **Positive**: one mental model; Apply is explicit; dead snapshot tables/columns removable (PR6).
- **Negative**: operators must Apply when Shopify diverges; badges can show CONFLICT until then.
- **Risks**: any new automatic Synarava writer is a regression — guard tests under `lib/shopify/__tests__/auto-sync-no-synarava-writers.guard.test.ts`.
