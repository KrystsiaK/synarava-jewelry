# Translation sync — two-state operations

**Status:** live (two-way translation compare)  
**Date:** 2026-10-23  
**Day-to-day checklist:** [`docs/runbooks/translation-operations.md`](../runbooks/translation-operations.md)  
**Contract:** [ADR-0008](../adr/0008-sync-two-state-owner-model.md), [`docs/history/sync-unification.md`](../history/sync-unification.md) (historical)

## Model

| Axis | Synarava | Shopify | Detect |
| --- | --- | --- | --- |
| Non-default locale field | `ProductTranslation` / `CollectionTranslation` / `PageTranslation` row + binding | Live Translations API value | Two-way compare (both sides, or one-sided) |
| Default locale (EN) | **Base columns only** on `Product` / `Collection` / `Page` (never a `locale='en'` translation row) | Shopify source / `translatableContent` | Commerce window deep-diff (product/collection); page EN via base columns in reconcile apply |
| Commerce (shared) | Derived OUR window (columns + `extras`) | `shopifySnapshot` | Deep-diff after one normalize (ADR-0003 / ADR-0009) |

**Data model rule (Option A):** English is authoritative on base columns. Translation tables hold only non-default locales (PT, RU, …). Admin EN tab reads/writes base columns; language bundle export/import for the default locale maps to/from those base columns. Archive + delete of historical `locale='en'` rows: migration `20261025214900_archive_and_drop_en_translation_rows` (rollback: `scripts/db/rollback-en-translation-rows.sql`; pre-check: `scripts/db/check-en-translation-rows.sql`).

Compare is two-way only: `ShopifyTranslationSnapshot` and `lastSyncedSnapshot` are removed. Language bundle export/import still ships locale rows + cache; legacy `translationSnapshots` in older bundles are ignored on import.

## Rules

1. **Nothing automatic writes Synarava translations** — pull/refresh/webhook paths refresh Shopify observations and conflict flags only.
2. **Human Apply only** — preview → confirm → scoped write (Synarava ← Shopify or Synarava → Shopify).
3. **One UI pattern** — catalog conflict dialogs from Localization and from product/collection editors (same preview/apply stack).

## Audit

Human sync actions remain on `TranslationSyncEvent` / reconcile runs. Do not reintroduce ancestor snapshot tables for compare.
