# AI product content — provider benchmark

**Status:** scaffolding + probe (no winner declared)
**Generated:** 2026-11-21T23:39:16.367Z
**Hard budget:** $1.50
**Spent this run:** $0.000000
**Products:** _none_
**Locales:** EN, PT-PT, RU

Production `ContentProvider` remains a **stub** until the architect picks a winner. Bench adapters live only under `scripts/ai/bench/`.

## Pre-run model card

| Model | ID | Availability | Price in/out ($/1M) | Structured output | Price source |
|---|---|---|---|---|---|
| Gemini 3.1 Flash-Lite | `gemini-3.1-flash-lite` | skipped: no key | $0.25 / $1.5 | yes | https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite (+ public list $0.25/$1.50) |
| Claude Haiku 5.5 | `claude-haiku-5-5` | skipped: no key | $0.1 / $0.5 | yes | https://platform.claude.com/docs/en/models/haiku-5-5/overview (≤100k prompt tier) |
| Claude Sonnet 5.5 | `claude-sonnet-5-5` | skipped: no key | $2 / $10 | yes | https://platform.claude.com/docs/en/models/sonnet-5-5/overview |
| OpenAI gpt-5-nano (cheapest structured) | `gpt-5-nano` | skipped: no key | $0.05 / $0.4 | yes | https://developers.openai.com/api/docs/pricing — cheapest first-party model with structured outputs at capture |

## Metrics

| model | productId | name | status | schema ok | latencyMs | tokens in | tokens out | costUsd | claim warnings | error |
|---|---|---|---|---|---|---|---|---|---|---|
| gemini-3.1-flash-lite | (none) | (no products) | skipped: no key |  |  |  |  |  |  |  |
| claude-haiku-5-5 | (none) | (no products) | skipped: no key |  |  |  |  |  |  |  |
| claude-sonnet-5-5 | (none) | (no products) | skipped: no key |  |  |  |  |  |  |  |
| gpt-5-nano | (none) | (no products) | skipped: no key |  |  |  |  |  |  |  |

## Human score sheet (empty — fill manually)

| model | product | factual errors (human) | quality EN (1–5) | quality PT-PT (1–5) | quality RU (1–5) | brand (1–5) | edit minutes |
|---|---|---|---|---|---|---|---|
| _no successful outputs_ | | | | | | | |

## Side-by-side raw texts

Raw JSON outputs are written under `.artifacts/ai-bench/` (gitignored), not committed:

_No raw artifacts (all models skipped or no products)._

## Notes

- OpenAI pick: `gpt-5-nano` — cheapest first-party model with structured outputs on [OpenAI pricing](https://developers.openai.com/api/docs/pricing) at capture ($0.05 / $0.40 per 1M).
- Claude: `output_config.format = json_schema`, `effort: "low"`, no temperature.
- Gemini: REST `generateContent` + `responseJsonSchema`.
- Same facts / system / user / schema for every model×product cell.
- **Do not treat this file as a winner decision.**
