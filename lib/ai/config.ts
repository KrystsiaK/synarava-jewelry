/**
 * AI Product Content Engine — env variable names (values never hardcoded).
 *
 * Expected names (add to the repo env example file when protect-env hook allows):
 * - GEMINI_API_KEY
 * - GEMINI_MODEL (legacy alias; prefer AI_CONTENT_MODEL)
 * - ANTHROPIC_API_KEY (bench only)
 * - OPENAI_API_KEY (bench only)
 * - AI_CONTENT_ENABLED
 * - AI_CONTENT_MODEL (production model; default gemini-3.1-flash-lite)
 * - AI_MAX_OUTPUT_TOKENS (default 16384 — full locale-tab field set × 3 locales)
 * - AI_MAX_INPUT_CHARS (default 12000)
 * - AI_EDITOR_PASS (default 0; set 1/true to run second editorial polish call)
 * - AI_MONTHLY_BUDGET_USD
 * - AI_RATE_LIMIT_MAX (optional; default 20)
 * - AI_RATE_LIMIT_WINDOW_MS (optional; default 3_600_000)
 */

export const DEFAULT_GEMINI_MODEL = "gemini-3.1-flash-lite";
export const DEFAULT_AI_CONTENT_MODEL = DEFAULT_GEMINI_MODEL;
export const GEMINI_TIMEOUT_MS = 30_000;
export const DEFAULT_MONTHLY_BUDGET_USD = 5;
export const DEFAULT_RATE_LIMIT_MAX = 20;
export const DEFAULT_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
/** Ceiling for full locale-tab field set (product + details + specs) × EN/PT/RU. */
export const DEFAULT_MAX_OUTPUT_TOKENS = 16_384;
export const DEFAULT_MAX_INPUT_CHARS = 12_000;
export const AI_AUDIT_ACTION = "ai.product_content.generate";
/** Marketing Reels ideas — counts toward the same monthly AI budget. */
export const AI_MARKETING_IDEAS_AUDIT_ACTION = "ai.marketing.ideas.generate";

/** All AuditLog actions that spend against AI_MONTHLY_BUDGET_USD. */
export const AI_BUDGET_AUDIT_ACTIONS = [
  AI_AUDIT_ACTION,
  AI_MARKETING_IDEAS_AUDIT_ACTION,
] as const;

/**
 * Single price table: model → USD per 1M input / output tokens.
 * Sources checked 2026-11-21 (also used by scripts/ai/bench).
 */
export type ModelPriceEntry = {
  inputUsdPer1M: number;
  outputUsdPer1M: number;
  structuredOutput: boolean;
  priceSource: string;
  provider: "gemini" | "claude" | "openai";
  envKey: string;
  label: string;
};

export const MODEL_PRICE_TABLE: Record<string, ModelPriceEntry> = {
  "gemini-3.1-flash-lite": {
    label: "Gemini 3.1 Flash-Lite",
    provider: "gemini",
    inputUsdPer1M: 0.25,
    outputUsdPer1M: 1.5,
    structuredOutput: true,
    priceSource:
      "https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite (+ public list $0.25/$1.50)",
    envKey: "GEMINI_API_KEY",
  },
  "claude-haiku-5-5": {
    label: "Claude Haiku 5.5",
    provider: "claude",
    inputUsdPer1M: 0.1,
    outputUsdPer1M: 0.5,
    structuredOutput: true,
    priceSource: "https://platform.claude.com/docs/en/models/haiku-5-5/overview (≤100k prompt tier)",
    envKey: "ANTHROPIC_API_KEY",
  },
  "claude-sonnet-5-5": {
    label: "Claude Sonnet 5.5",
    provider: "claude",
    inputUsdPer1M: 2,
    outputUsdPer1M: 10,
    structuredOutput: true,
    priceSource: "https://platform.claude.com/docs/en/models/sonnet-5-5/overview",
    envKey: "ANTHROPIC_API_KEY",
  },
  "gpt-5-nano": {
    label: "OpenAI gpt-5-nano (cheapest structured)",
    provider: "openai",
    inputUsdPer1M: 0.05,
    outputUsdPer1M: 0.4,
    structuredOutput: true,
    priceSource:
      "https://developers.openai.com/api/docs/pricing — cheapest first-party model with structured outputs at capture",
    envKey: "OPENAI_API_KEY",
  },
};

/** @deprecated Prefer MODEL_PRICE_TABLE[model].inputUsdPer1M */
export const GEMINI_INPUT_USD_PER_1M =
  MODEL_PRICE_TABLE["gemini-3.1-flash-lite"]!.inputUsdPer1M;
/** @deprecated Prefer MODEL_PRICE_TABLE[model].outputUsdPer1M */
export const GEMINI_OUTPUT_USD_PER_1M =
  MODEL_PRICE_TABLE["gemini-3.1-flash-lite"]!.outputUsdPer1M;

export function isAiContentEnabled(): boolean {
  const raw = process.env.AI_CONTENT_ENABLED?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

export function getGeminiApiKey(): string | undefined {
  const key = process.env.GEMINI_API_KEY?.trim();
  return key || undefined;
}

/** Production model id (AI_CONTENT_MODEL → GEMINI_MODEL → default). */
export function getAiContentModel(): string {
  return (
    process.env.AI_CONTENT_MODEL?.trim() ||
    process.env.GEMINI_MODEL?.trim() ||
    DEFAULT_AI_CONTENT_MODEL
  );
}

/** @deprecated Prefer getAiContentModel() */
export function getGeminiModel(): string {
  return getAiContentModel();
}

export function getMaxOutputTokens(): number {
  const raw = Number(process.env.AI_MAX_OUTPUT_TOKENS?.trim());
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULT_MAX_OUTPUT_TOKENS;
}

export function getMaxInputChars(): number {
  const raw = Number(process.env.AI_MAX_INPUT_CHARS?.trim());
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULT_MAX_INPUT_CHARS;
}

/** Second editorial polish pass (default off). */
export function isAiEditorPassEnabled(): boolean {
  const raw = process.env.AI_EDITOR_PASS?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

export function getMonthlyBudgetUsd(): number {
  const raw = process.env.AI_MONTHLY_BUDGET_USD?.trim();
  if (!raw) return DEFAULT_MONTHLY_BUDGET_USD;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_MONTHLY_BUDGET_USD;
}

export function getRateLimitOpts(): { max: number; windowMs: number } {
  const maxRaw = Number(process.env.AI_RATE_LIMIT_MAX?.trim());
  const windowRaw = Number(process.env.AI_RATE_LIMIT_WINDOW_MS?.trim());
  return {
    max: Number.isFinite(maxRaw) && maxRaw > 0 ? maxRaw : DEFAULT_RATE_LIMIT_MAX,
    windowMs:
      Number.isFinite(windowRaw) && windowRaw > 0
        ? windowRaw
        : DEFAULT_RATE_LIMIT_WINDOW_MS,
  };
}

/** Cost from the shared model → $/1M price table (0 if model unknown). */
export function estimateCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const price = MODEL_PRICE_TABLE[model];
  if (!price) return 0;
  const input = (Math.max(0, inputTokens) / 1_000_000) * price.inputUsdPer1M;
  const output = (Math.max(0, outputTokens) / 1_000_000) * price.outputUsdPer1M;
  return Math.round((input + output) * 1_000_000) / 1_000_000;
}

/** Ceiling estimate: inputChars/4 + maxOutputTokens against the price table. */
export function estimateCeilingCostUsd(inputChars: number, model = getAiContentModel()): number {
  const inputTokens = Math.ceil(Math.max(0, inputChars) / 4);
  return estimateCostUsd(model, inputTokens, getMaxOutputTokens());
}

/**
 * Ceiling for a full generate (1 or 2 provider calls when AI_EDITOR_PASS is on).
 * Spec 8c/10: budget check uses call-count × single-call ceiling.
 */
export function estimateGenerationCeilingCostUsd(
  inputChars: number,
  options?: { editorPass?: boolean; model?: string },
): number {
  const calls = (options?.editorPass ?? isAiEditorPassEnabled()) ? 2 : 1;
  return estimateCeilingCostUsd(inputChars, options?.model ?? getAiContentModel()) * calls;
}
