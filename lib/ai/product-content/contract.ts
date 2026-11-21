export type AiLocale = "en" | "pt" | "ru";
export type AiField = "title" | "shortDescription" | "description" | "seoTitle" | "seoDescription";
export type ProductContentDraft = {
  productId: string;
  sourceUpdatedAt: string; // product.updatedAt (ISO) at generation time
  locales: Partial<Record<AiLocale, Partial<Record<AiField, string>>>>; // en.title NEVER
  warnings: { locale: AiLocale; field: AiField; message: string }[];
  usage: { model: string; inputTokens: number; outputTokens: number; costUsd: number; latencyMs: number };
};
export type GenerateResult =
  | { ok: true; draft: ProductContentDraft }
  | { ok: false; code: "disabled" | "unauthorized" | "not_found" | "rate_limited" | "budget_exhausted" | "timeout" | "provider_error" | "invalid_output"; message: string };
