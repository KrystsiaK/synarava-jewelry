# Translation sync — two-state operations

**Status:** live (sync-unification PR3 + PR6 cleanup)  
**Date:** 2026-10-23  
**Day-to-day checklist:** [`docs/runbooks/translation-operations.md`](../runbooks/translation-operations.md)  
**Contract:** [ADR-0008](../adr/0008-sync-two-state-owner-model.md), [`docs/proposals/sync-unification.md`](../proposals/sync-unification.md)

## Model

| Axis | Synarava | Shopify | Detect |
| --- | --- | --- | --- |
| Locale field | `*Translation` row / binding | Live Translations API value | Two-way compare (both sides, or one-sided) |
| Commerce (shared) | `workingSnapshot` | `shopifySnapshot` | Deep-diff after one normalize (ADR-0003) |

There is **no** third state: `ShopifyTranslationSnapshot` and `lastSyncedSnapshot` are removed. Language bundle export/import still ships locale rows + cache; legacy `translationSnapshots` in older bundles are ignored on import.

## Rules

1. **Nothing automatic writes Synarava translations** — pull/refresh/webhook paths refresh Shopify observations and conflict flags only.
2. **Human Apply only** — preview → confirm → scoped write (Synarava ← Shopify or Synarava → Shopify).
3. **One UI pattern** — catalog conflict dialogs from Localization and from product/collection editors (same preview/apply stack).

## Audit

Human sync actions remain on `TranslationSyncEvent` / reconcile runs. Do not reintroduce ancestor snapshot tables for compare.
