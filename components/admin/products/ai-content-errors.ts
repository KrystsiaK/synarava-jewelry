import type { GenerateResult } from "@/lib/ai/product-content/contract";

type FailureCode = Extract<GenerateResult, { ok: false }>["code"];

const TOAST_BY_CODE: Record<FailureCode, string> = {
  disabled: "AI content generation is disabled.",
  unauthorized: "You are not authorized to generate AI content.",
  not_found: "Product was not found for AI generation.",
  rate_limited: "Too many AI requests. Wait a moment and try again.",
  budget_exhausted: "AI budget is exhausted for this period.",
  timeout: "AI generation timed out. Try again.",
  provider_error: "AI provider error. Try again later.",
  invalid_output: "AI returned invalid content. Try again.",
};

/** Maps a failed generate result to a clear admin toast message. */
export function toastMessageForGenerateError(
  result: Extract<GenerateResult, { ok: false }>,
): string {
  return TOAST_BY_CODE[result.code] ?? result.message;
}
