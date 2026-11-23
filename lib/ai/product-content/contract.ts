import {
  modelTranslatableProductLocaleFields,
  type ProductLocaleTextFieldKey,
} from "@/lib/products/product-locale-text-fields";

export type AiLocale = "en" | "pt" | "ru";

/**
 * AI field keys = model-translatable entries from the shared Save/AI list
 * (`lib/products/product-locale-text-fields.ts`). Taxonomy references are excluded.
 */
export type AiField = ProductLocaleTextFieldKey;

/** Runtime list shared by generate / preview / Apply (not a parallel hardcode). */
export const AI_FIELDS: readonly AiField[] = modelTranslatableProductLocaleFields().map(
  (field) => field.key,
);

export type ProductContentDraft = {
  productId: string;
  sourceUpdatedAt: string;
  /** Flat map over AI_FIELDS. en.title NEVER applied. */
  locales: Partial<Record<AiLocale, Partial<Record<AiField, string>>>>;
  warnings: { locale: AiLocale; field: AiField; message: string }[];
  usage: { model: string; inputTokens: number; outputTokens: number; costUsd: number; latencyMs: number };
};

export type GenerateResult =
  | { ok: true; draft: ProductContentDraft }
  | {
      ok: false;
      code:
        | "disabled"
        | "unauthorized"
        | "not_found"
        | "rate_limited"
        | "budget_exhausted"
        | "timeout"
        | "provider_error"
        | "invalid_output";
      message: string;
    };
