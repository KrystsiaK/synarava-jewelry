/**
 * AI Product Content Engine — env variable names (values never hardcoded).
 *
 * Expected names (add to the repo env example file when protect-env hook allows):
 * - GEMINI_API_KEY
 * - GEMINI_MODEL (bench / legacy helper only until winner)
 * - ANTHROPIC_API_KEY (bench only)
 * - OPENAI_API_KEY (bench only)
 * - AI_CONTENT_ENABLED
 * - AI_CONTENT_MODEL (reserved — set after architect picks winner)
 * - AI_MONTHLY_BUDGET_USD
 * - AI_RATE_LIMIT_MAX (optional; default 20)
 * - AI_RATE_LIMIT_WINDOW_MS (optional; default 3_600_000)
 *
 * Production ContentProvider is a stub until the benchmark winner is wired.
 * Bench model ids (not production): gemini-3.1-flash-lite, claude-haiku-5-5,
 * claude-sonnet-5-5, gpt-5-nano.
 */

export const DEFAULT_GEMINI_MODEL = "gemini-3.1-flash-lite";
export const GEMINI_TIMEOUT_MS = 30_000;
export const DEFAULT_MONTHLY_BUDGET_USD = 5;
export const DEFAULT_RATE_LIMIT_MAX = 20;
export const DEFAULT_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
export const AI_AUDIT_ACTION = "ai.product_content.generate";

/** Published Gemini 3.1 Flash-Lite list prices (USD per 1M tokens). */
export const GEMINI_INPUT_USD_PER_1M = 0.25;
export const GEMINI_OUTPUT_USD_PER_1M = 1.5;

export function isAiContentEnabled(): boolean {
  const raw = process.env.AI_CONTENT_ENABLED?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

export function getGeminiApiKey(): string | undefined {
  const key = process.env.GEMINI_API_KEY?.trim();
  return key || undefined;
}

export function getGeminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
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

export function estimateCostUsd(inputTokens: number, outputTokens: number): number {
  const input = (Math.max(0, inputTokens) / 1_000_000) * GEMINI_INPUT_USD_PER_1M;
  const output = (Math.max(0, outputTokens) / 1_000_000) * GEMINI_OUTPUT_USD_PER_1M;
  return Math.round((input + output) * 1_000_000) / 1_000_000;
}
