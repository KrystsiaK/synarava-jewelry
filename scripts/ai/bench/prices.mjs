/**
 * Live list prices captured for the TASK-001 provider benchmark (USD / 1M tokens).
 * Sources checked 2026-11-21:
 * - Gemini 3.1 Flash-Lite: https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite
 *   (Post-Cutoff / public listings: $0.25 in / $1.50 out)
 * - Claude Haiku 5.5 / Sonnet 5.5: https://platform.claude.com/docs/en/models/haiku-5-5/overview
 *   and https://platform.claude.com/docs/en/models/sonnet-5-5/overview
 * - OpenAI: https://developers.openai.com/api/docs/pricing — cheapest structured-output
 *   first-party chat model at capture: gpt-5-nano ($0.05 / $0.40)
 */

export const MODEL_PRICES = {
  "gemini-3.1-flash-lite": {
    id: "gemini-3.1-flash-lite",
    provider: "gemini",
    inputUsdPer1M: 0.25,
    outputUsdPer1M: 1.5,
    structuredOutput: true,
    priceSource: "https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite (+ public list $0.25/$1.50)",
    envKey: "GEMINI_API_KEY",
  },
  "claude-haiku-5-5": {
    id: "claude-haiku-5-5",
    provider: "claude",
    inputUsdPer1M: 0.1,
    outputUsdPer1M: 0.5,
    structuredOutput: true,
    priceSource: "https://platform.claude.com/docs/en/models/haiku-5-5/overview (≤100k prompt tier)",
    envKey: "ANTHROPIC_API_KEY",
  },
  "claude-sonnet-5-5": {
    id: "claude-sonnet-5-5",
    provider: "claude",
    inputUsdPer1M: 2,
    outputUsdPer1M: 10,
    structuredOutput: true,
    priceSource: "https://platform.claude.com/docs/en/models/sonnet-5-5/overview",
    envKey: "ANTHROPIC_API_KEY",
  },
  "gpt-5-nano": {
    id: "gpt-5-nano",
    provider: "openai",
    inputUsdPer1M: 0.05,
    outputUsdPer1M: 0.4,
    structuredOutput: true,
    priceSource:
      "https://developers.openai.com/api/docs/pricing — cheapest first-party model with structured outputs at capture",
    envKey: "OPENAI_API_KEY",
  },
};

export function estimateCostUsd(modelId, inputTokens, outputTokens) {
  const price = MODEL_PRICES[modelId];
  if (!price) return 0;
  const input = (Math.max(0, inputTokens) / 1_000_000) * price.inputUsdPer1M;
  const output = (Math.max(0, outputTokens) / 1_000_000) * price.outputUsdPer1M;
  return Math.round((input + output) * 1_000_000) / 1_000_000;
}
