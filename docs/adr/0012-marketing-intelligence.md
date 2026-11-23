# ADR-0012: Marketing Intelligence MVP

**Date**: 2026-11-23  
**Status**: accepted  
**Deciders**: владелец проекта  
**Relates**: [ADR-0011](0011-ai-draft-into-form.md), research [`docs/research/task-002/`](../research/task-002/)

## Context

Synarava needs a minimal Marketing Intelligence loop: watch a fixed list of competitor product pages (public sitemap + structured data), record dated observations when something changes, and generate owner-approvable Reels ideas from real Synarava products plus optional market signals. Social scraping, automatic publishing, Product/ProductTranslation writes, cron, and new npm dependencies are out of scope. TikTok competitor tracking has no compliant source and stays parked.

## Decision

1. **Exactly two new tables** — `CompetitorObservation` (append-only evidence) and `ContentIdea` (editable content calendar). Monitored domains live in code (`lib/marketing/competitors/targets.ts`), not in the database.
2. **Providers map into `MarketSignal`** — every source (website observation, owner-pasted note; later Metricool/Meta) normalizes to one record. The AI ideas layer reads only `MarketSignal` and never imports a provider.
3. **`AuditLog` records events, not the calendar** — generate / approve / reject / edit / scan write AuditLog rows; the calendar store is `ContentIdea`.
4. **No social scraping, no automatic publishing, no product writes** — collector is fetch + robots + sitemap + JSON-LD/og/Shopify `.js` only; ideas never mutate Product / ProductTranslation.
5. **Reuse AI safety rails from ADR-0011** — kill-switch, monthly budget (including `ai.marketing.ideas.generate`), rate limit, claim-guard, `scrubPromptInjectionText`, Gemini via `getContentProvider()`.

## Alternatives Considered

### Store calendar state only in AuditLog
- **Why not**: AuditLog is an event stream; editing/scheduling approved ideas needs a mutable calendar row (owner decision after research review).

### Per-brand source table + cron crawler
- **Why not**: overbuilds MVP; fixed allowlist in code + manual "Scan now" is enough; no cron.

### Social scraping / Apify / Firecrawl
- **Why not**: legal and ToS risk; research PoC showed public structured data is sufficient for website competitors.

## Consequences

- **Positive**: clear evidence trail; human-owned calendar; AI stays on Synarava product facts + scrubbed signals; budget shared with product-content AI.
- **Negative**: no automatic scan schedule; Instagram/TikTok competitor metrics deferred; geo-variant prices (e.g. Anni-Lu) may differ by bot IP.
- **Risks**: competitor HTML changes break extractors — mitigate with fixture tests and source fallbacks (json-ld → og → shopify-js).
