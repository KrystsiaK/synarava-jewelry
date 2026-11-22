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
4. **Provider = Gemini 3.1 Flash-Lite** — chosen after live Stage B/C bench (see table + [`docs/ai/provider-benchmark.md`](../ai/provider-benchmark.md) Decision). Production wire: `lib/ai/gemini.ts` + `AI_CONTENT_MODEL`.
5. **Editor pass off by default** — `AI_EDITOR_PASS` opt-in; fail-soft keeps first draft.

## Bench summary (Gemini / Haiku / Sonnet)

Live measurements from `scripts/ai/bench/run.mjs` (owner-run). **OpenAI was not measured** (owner decision). Full Decision section: [`docs/ai/provider-benchmark.md`](../ai/provider-benchmark.md).

| Model | $ per product | latency | schema | serious errors |
| --- | --- | --- | --- | --- |
| Gemini 3.1 Flash-Lite | ~$0.0012 | 1–4 s | 15/15 (with Claude run), then 30/30 ×2 runs | none |
| Claude Haiku 5.5 | ~$0.0009 | 4–11 s | 5/5 | empty RU fields, RU grammar («Ручной колье») |
| Claude Sonnet 5.5 | ~$0.016 | 3–12 s | 5/5 | English phrase inside RU text |
| OpenAI gpt-5-nano | — | — | — | not measured (owner decision) |

**Fixtures (Gemini, 3 repeats):** prompt injection blocked 3/3; "Silver Ring" without facts — 0 invented 925/sterling; earring without data — model writes "single", claim-guard catches 3/3; on real products after fixes — 0 false warnings.

**Justification:** Gemini is the only model without serious errors, fastest, ~$1.2 per 1000 products. Total bench cost ≈ $0.25.

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
