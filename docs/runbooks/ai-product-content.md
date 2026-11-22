# AI product content — ops runbook

How to enable, disable, budget, and evaluate the **Generate with AI** path in the product editor. Draft-only: generation never writes product texts; human **Save** remains the persist path ([ADR-0011](../adr/0011-ai-draft-into-form.md), [ADR-0008](../adr/0008-sync-two-state-owner-model.md) / [ADR-0009](../adr/0009-derive-synarava-commerce-state.md)).

## Environment variables

| Name | Role | Default / notes |
| --- | --- | --- |
| `GEMINI_API_KEY` | Google AI Studio / Gemini API key | required when enabled |
| `AI_CONTENT_ENABLED` | Kill-switch (`1`/`true`/`yes`/`on`) | off |
| `AI_CONTENT_MODEL` | Production model id | `gemini-3.1-flash-lite` |
| `AI_MAX_OUTPUT_TOKENS` | Provider max output tokens | `4096` |
| `AI_MAX_INPUT_CHARS` | Facts prompt ceiling | `12000` |
| `AI_EDITOR_PASS` | Second editorial polish call | off (`0`) |
| `AI_MONTHLY_BUDGET_USD` | Soft monthly spend ceiling (AuditLog sum) | `5` |
| `AI_RATE_LIMIT_MAX` | Max generates per actor per window | `20` |
| `AI_RATE_LIMIT_WINDOW_MS` | Rate-limit window | `3600000` (1h) |

Legacy: `GEMINI_MODEL` is an alias for `AI_CONTENT_MODEL`. Bench-only keys (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`) are not required for production generate.

**`.env.example`:** agents cannot write `.env*` (protect-env hook). Names-only template: [`docs/ai/ai-content.env.example`](../ai/ai-content.env.example). Owner should copy those names into the repo `.env.example` (values empty).

Source of truth for parsers/defaults: `lib/ai/config.ts`.

## Enable / disable (kill-switch)

1. **Off (default):** leave `AI_CONTENT_ENABLED` unset or `0`. UI control stays hidden; `generateProductContent` returns `disabled`.
2. **On (staging / controlled prod):** set `AI_CONTENT_ENABLED=1` and `GEMINI_API_KEY=<secret>` in the host env (Railway / Vercel / local). Redeploy or restart so the process picks up env.
3. **Immediate disable:** set `AI_CONTENT_ENABLED=0` (or unset) and restart. No code revert required.

## Rollback

1. Flip kill-switch: `AI_CONTENT_ENABLED=0` → restart.
2. If a bad release must leave the tree: revert the AI content PR(s) on the integration branch (owner merge only; bots do not merge).
3. Product rows are untouched by generate; only `AuditLog` rows with action `ai.product_content.generate` exist as telemetry.

## Three-layer limits

| Layer | What | Where |
| --- | --- | --- |
| 1. App | Monthly budget (`AI_MONTHLY_BUDGET_USD` via AuditLog `costUsd`), per-actor rate limit, input/output token ceilings | `lib/ai/product-content/budget.ts`, `generate.ts`, `lib/ai/config.ts` |
| 2. Google Cloud / AI Studio | Project quota and RPM/TPM for the Gemini API | Google Cloud console / AI Studio |
| 3. Billing alert | Budget alert on the GCP / billing account | Cloud Billing budgets |

All three should be set before enabling in production. App budget alone is not a hard stop against provider overages under race (see Known limits).

## Change model or provider

1. Production path is Gemini REST in `lib/ai/gemini.ts` (wired by `getContentProvider()`).
2. Change model id via `AI_CONTENT_MODEL` (must exist in `MODEL_PRICE_TABLE` in `lib/ai/config.ts` for cost estimates).
3. Changing **provider** (not just model id) means replacing / extending `lib/ai/gemini.ts` and the lazy wire in `lib/ai/product-content/provider.ts`, then updating the price table and this runbook.
4. Re-run bench before flipping production: see below.

## Bench

```bash
AI_CONTENT_ENABLED=1 node scripts/ai/bench/run.mjs --fixtures --models gemini --repeat 3 --budget 0.20
# optional second pass:
AI_CONTENT_ENABLED=1 node scripts/ai/bench/run.mjs --fixtures --models gemini --repeat 3 --budget 0.20 --editor
```

Report: `docs/ai/provider-benchmark.md`. Raw JSON under `.artifacts/ai-bench/` (gitignored).

## M4 evaluate (read-only)

```bash
AI_CONTENT_ENABLED=1 node scripts/ai/m4-evaluate.mjs
# or explicit ids:
AI_CONTENT_ENABLED=1 node scripts/ai/m4-evaluate.mjs <productId> ...
```

- Loads 10 products (argv ids, else 10 latest `ACTIVE`).
- Calls production `generateProductContent` with **script-only `dryRun`** (no `AuditLog` write).
- Writes metrics + empty owner score columns to `docs/ai/m4-results.md`.

Does not write Product / ProductTranslation. Prefer a local or staging DB URL; never point at production unless the owner explicitly asks.

## Known limits

- **Budget race:** monthly spend is checked then audited; concurrent generates can overshoot `AI_MONTHLY_BUDGET_USD` slightly.
- **Claim-guard heuristic:** advisory warnings (numbers / material synonyms); not a proof of factual correctness. Human must still verify.
- **Saved data only:** generate reads the **saved** product row, not unsaved form fields. Save before Generate if the form is dirty.
- **Model may write “single”:** still appears as a warning when facts do not support it; draft is not auto-applied.
- **OpenAI not measured:** Stage B/C owner decision — OpenAI stayed out of the winner comparison; do not treat `gpt-*` as production-ready without a new bench + ADR update.

## Related

- Owner UI guide (RU): [`docs/user/ai-generate-content-ru.md`](../user/ai-generate-content-ru.md)
- ADR: [`docs/adr/0011-ai-draft-into-form.md`](../adr/0011-ai-draft-into-form.md)
