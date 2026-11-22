# AI product content — provider benchmark

**Status:** decision recorded (Gemini 3.1 Flash-Lite = production)
**Locales:** EN, PT-PT, RU
**Runner:** `scripts/ai/bench/run.mjs` (adapters under `scripts/ai/bench/`; prompt / schema / validate / price table from `lib/ai/**`)

## Decision

Winner: **Gemini 3.1 Flash-Lite** (`AI_CONTENT_MODEL`, production `lib/ai/gemini.ts`). See also [ADR-0011](../adr/0011-ai-draft-into-form.md).

| Model | $ per product | latency | schema | serious errors |
| --- | --- | --- | --- | --- |
| Gemini 3.1 Flash-Lite | ~$0.0012 | 1–4 s | 15/15, then 30/30 in final run | none |
| Claude Haiku 5.5 | ~$0.0009 | 4–11 s | 5/5 | empty RU fields, RU grammar («Ручной колье») |
| Claude Sonnet 5.5 | ~$0.016 | 3–12 s | 5/5 | English phrase inside RU text |
| OpenAI gpt-5-nano | — | — | — | not measured (owner decision) |

**Fixtures (Gemini, 3 repeats):** prompt injection reflected 3/3; "Silver Ring" without facts — 0 invented 925/sterling; earring without data — model writes "single", claim-guard catches 3/3; on real products after fixes — 0 false warnings.

**Justification:** only model with no serious errors, fastest, ~$1.2 per 1000 products. Benchmark cost ≈ $0.25.

## Pre-run model card (list prices)

| Model | ID | Price in/out ($/1M) | Structured output | Price source |
|---|---|---|---|---|
| Gemini 3.1 Flash-Lite | `gemini-3.1-flash-lite` | $0.25 / $1.5 | yes | https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite (+ public list $0.25/$1.50) |
| Claude Haiku 5.5 | `claude-haiku-5-5` | $0.1 / $0.5 | yes | https://platform.claude.com/docs/en/models/haiku-5-5/overview (≤100k prompt tier) |
| Claude Sonnet 5.5 | `claude-sonnet-5-5` | $2 / $10 | yes | https://platform.claude.com/docs/en/models/sonnet-5-5/overview |
| OpenAI gpt-5-nano (cheapest structured) | `gpt-5-nano` | $0.05 / $0.4 | yes | https://developers.openai.com/api/docs/pricing — cheapest first-party model with structured outputs at capture |

## Notes

- OpenAI stayed out of the winner comparison (owner decision) — do not treat `gpt-*` as production-ready without a new bench + ADR update.
- Claude: `output_config.format = json_schema`, `effort: "low"`, no temperature.
- Gemini: REST `generateContent` + `responseJsonSchema`.
- Same facts / system / user / schema for every model×product cell (from `lib/ai`).
- Raw JSON outputs (if retained) live under `.artifacts/ai-bench/` (gitignored), not committed.
