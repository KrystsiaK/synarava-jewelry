# ADR-0011: AI product content — draft into form only

**Date**: 2026-11-22  
**Status**: accepted  
**Deciders**: владелец проекта  
**Relates**: [ADR-0008](0008-sync-two-state-owner-model.md), [ADR-0009](0009-derive-synarava-commerce-state.md)

## Context

Catalog copy (short description, description, SEO, locale titles) is expensive to write by hand in EN / PT-PT / RU. We need an optional AI assist in the product editor without creating a parallel commerce store, without automatic Synarava overwrites, and without a new product data model. Sync ownership stays human Apply / Save ([ADR-0008](0008-sync-two-state-owner-model.md) / [ADR-0009](0009-derive-synarava-commerce-state.md)).

## Decision

1. **Draft into form only** — Generate returns a draft preview; Apply merges selected fields into **form state**. Persist happens only on human **Save**. Generate never writes Product / ProductTranslation.
2. **Sole generate write = AuditLog** — usage telemetry (`costUsd`, tokens, latency, outcome). No new tables or product columns for AI.
3. **Compatible with ADR-0008 / ADR-0009** — nothing automatic writes Synarava content; Shopify compare/Apply path unchanged.
4. **Provider = Gemini 3.1 Flash-Lite** — chosen after Stage B/C bench + owner pick (see table). Production wire: `lib/ai/gemini.ts` + `AI_CONTENT_MODEL`.
5. **Editor pass off by default** — `AI_EDITOR_PASS` opt-in; fail-soft keeps first draft.

## Bench summary (Gemini / Haiku / Sonnet)

List prices from `MODEL_PRICE_TABLE` (`lib/ai/config.ts`, captured 2026-11-21). Live latency / error cells are filled from owner bench runs of `scripts/ai/bench/run.mjs`; agent CI skipped keys. **OpenAI was not measured** (owner decision).

| Model | $/1M in | $/1M out | Structured JSON | Live latency | Live errors | Role |
| --- | ---: | ---: | --- | --- | --- | --- |
| Gemini 3.1 Flash-Lite | 0.25 | 1.50 | yes | owner bench | owner bench | **production winner** |
| Claude Haiku 5.5 | 0.10 | 0.50 | yes | owner bench | owner bench | measured in Stage B design; not production |
| Claude Sonnet 5.5 | 2.00 | 10.00 | yes | owner bench | owner bench | measured in Stage B design; not production |
| OpenAI (e.g. gpt-5-nano) | 0.05 | 0.40 | yes | **not measured** | **not measured** | out of scope per owner |

Winner rationale: Gemini Flash-Lite balances structured-output support, list price, and Synarava ops fit (single `GEMINI_API_KEY`, REST `generateContent`, no Anthropic SDK in production). Re-bench before changing production model/provider.

## Alternatives Considered

### Auto-write Product / ProductTranslation on Generate
- **Why not**: violates ADR-0008/0009 “nothing automatic writes Synarava content”; bypasses human review.

### New AI draft tables / columns as SoT
- **Why not**: parallel data model; draft belongs in the editor form until Save.

### OpenAI as production provider without bench
- **Why not**: owner deferred measurement; cannot claim cost/quality winner.

### Editor polish pass always on
- **Why not**: doubles token cost and latency; default off keeps budget predictable.

## Consequences

- **Positive**: human remains the writer; kill-switch + budget + rate limit; AuditLog-only telemetry; UI Apply is reversible until Save.
- **Negative**: generate uses **saved** product facts (not unsaved form); claim-guard is heuristic; monthly budget can race under concurrency.
- **Risks**: provider quota / billing alerts must sit outside the app budget. Mitigate with three-layer limits in [`docs/runbooks/ai-product-content.md`](../runbooks/ai-product-content.md).
