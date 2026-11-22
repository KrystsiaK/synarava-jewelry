import { checkRateLimit } from "@/lib/auth/rate-limit";
import {
  estimateCostUsd,
  estimateGenerationCeilingCostUsd,
  getAiContentModel,
  getRateLimitOpts,
  GEMINI_TIMEOUT_MS,
  isAiContentEnabled,
  isAiEditorPassEnabled,
} from "@/lib/ai/config";
import {
  assertMonthlyBudgetAvailable,
  writeAiGenerationAudit,
} from "@/lib/ai/product-content/budget";
import type {
  AiLocale,
  GenerateResult,
  ProductContentDraft,
} from "@/lib/ai/product-content/contract";
import {
  buildProductContentFacts,
  truncateFactsForPrompt,
  type ProductForFacts,
} from "@/lib/ai/product-content/facts";
import {
  ContentProviderNotConfiguredError,
  getContentProvider,
  type ContentProvider,
} from "@/lib/ai/product-content/provider";
import {
  buildEditorSystemInstruction,
  buildEditorUserPrompt,
  buildSystemInstruction,
  buildUserPrompt,
} from "@/lib/ai/product-content/prompt";
import { PRODUCT_CONTENT_RESPONSE_SCHEMA } from "@/lib/ai/product-content/schema";
import { validateAndNormalizeDraftLocales } from "@/lib/ai/product-content/validate";
import { db } from "@/lib/db";

const VALID_LOCALES = new Set<AiLocale>(["en", "pt", "ru"]);

export type AdminActor = {
  username: string;
  sessionId: string;
};

type ProviderUsage = {
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
};

function normalizeLocales(locales: AiLocale[]): AiLocale[] {
  const unique: AiLocale[] = [];
  for (const locale of locales) {
    if (!VALID_LOCALES.has(locale)) continue;
    if (!unique.includes(locale)) unique.push(locale);
  }
  return unique;
}

function sumUsage(a: ProviderUsage, b: ProviderUsage | null): ProviderUsage {
  if (!b) return a;
  return {
    model: a.model || b.model,
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    latencyMs: a.latencyMs + b.latencyMs,
  };
}

async function loadProductForFacts(productId: string): Promise<
  | (ProductForFacts & { updatedAt: Date })
  | null
> {
  return db.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      name: true,
      productType: true,
      materialLine: true,
      shortDescription: true,
      description: true,
      seoTitle: true,
      seoDescription: true,
      details: true,
      updatedAt: true,
      characteristics: {
        select: {
          key: true,
          label: true,
          textValue: true,
          numberValue: true,
          booleanValue: true,
          unit: true,
        },
        orderBy: { sortOrder: "asc" },
      },
      collections: {
        select: {
          collection: { select: { name: true } },
        },
      },
      translations: {
        select: {
          locale: true,
          title: true,
          shortDescription: true,
          description: true,
          materialLine: true,
          seoTitle: true,
          seoDescription: true,
        },
      },
    },
  });
}

function mapProviderError(error: unknown): GenerateResult {
  if (error instanceof ContentProviderNotConfiguredError) {
    return {
      ok: false,
      code: "disabled",
      message: error.message,
    };
  }
  if (error instanceof Error && error.name === "AbortError") {
    return {
      ok: false,
      code: "timeout",
      message: error.message || "Provider request timed out",
    };
  }
  const message = error instanceof Error ? error.message : "Provider request failed";
  const lower = message.toLowerCase();
  if (lower.includes("timeout") || lower.includes("aborted")) {
    return { ok: false, code: "timeout", message };
  }
  return { ok: false, code: "provider_error", message };
}

/**
 * Core generate flow (read-only Product load; sole write = AuditLog).
 * Production ContentProvider = Gemini (AI_CONTENT_MODEL).
 * Optional second editor pass when AI_EDITOR_PASS is on.
 */
export async function generateProductContent(input: {
  productId: string;
  locales: AiLocale[];
  actor: AdminActor;
  /** Optional override (tests). Defaults to getContentProvider(). */
  provider?: ContentProvider;
  /** Test override for editor pass (defaults to isAiEditorPassEnabled()). */
  editorPass?: boolean;
}): Promise<GenerateResult> {
  if (!isAiContentEnabled()) {
    return {
      ok: false,
      code: "disabled",
      message: "AI content generation is disabled (AI_CONTENT_ENABLED)",
    };
  }

  const locales = normalizeLocales(input.locales);
  if (locales.length === 0) {
    return {
      ok: false,
      code: "invalid_output",
      message: "At least one locale (en|pt|ru) is required",
    };
  }

  const rate = await checkRateLimit(
    "ai.product_content.generate",
    input.actor.username,
    getRateLimitOpts(),
  );
  if (!rate.ok) {
    return {
      ok: false,
      code: "rate_limited",
      message: rate.error,
    };
  }

  const product = await loadProductForFacts(input.productId);
  if (!product) {
    return {
      ok: false,
      code: "not_found",
      message: "Product not found",
    };
  }

  const prepared = truncateFactsForPrompt(buildProductContentFacts(product));
  if (!prepared.ok) {
    return {
      ok: false,
      code: "invalid_output",
      message: prepared.message,
    };
  }

  const facts = prepared.facts;
  const sourceWarnings: ProductContentDraft["warnings"] = prepared.truncated
    ? [{ locale: "en", field: "description", message: "source truncated" }]
    : [];

  const editorPass = input.editorPass ?? isAiEditorPassEnabled();
  const estimatedAdditionalUsd = estimateGenerationCeilingCostUsd(prepared.inputChars, {
    editorPass,
    model: getAiContentModel(),
  });
  const budget = await assertMonthlyBudgetAvailable(estimatedAdditionalUsd);
  if (!budget.ok) {
    return {
      ok: false,
      code: "budget_exhausted",
      message: `Monthly AI budget exhausted (spent $${budget.spent.toFixed(4)} / $${budget.budget})`,
    };
  }

  const provider = input.provider ?? getContentProvider();
  const system = buildSystemInstruction(locales);
  const user = buildUserPrompt(facts, locales);

  let firstResult: Awaited<ReturnType<ContentProvider>>;
  try {
    firstResult = await provider({
      system,
      user,
      jsonSchema: PRODUCT_CONTENT_RESPONSE_SCHEMA as unknown as object,
      timeoutMs: GEMINI_TIMEOUT_MS,
    });
  } catch (error) {
    return mapProviderError(error);
  }

  const firstValidated = validateAndNormalizeDraftLocales(
    firstResult.json,
    facts,
    locales,
  );

  if (!firstValidated) {
    const costUsd = estimateCostUsd(
      firstResult.usage.model,
      firstResult.usage.inputTokens,
      firstResult.usage.outputTokens,
    );
    await writeAiGenerationAudit({
      productId: product.id,
      adminUsername: input.actor.username,
      adminSessionId: input.actor.sessionId,
      usage: {
        model: firstResult.usage.model,
        inputTokens: firstResult.usage.inputTokens,
        outputTokens: firstResult.usage.outputTokens,
        costUsd,
        latencyMs: firstResult.usage.latencyMs,
        productId: product.id,
        locales,
        outcome: "invalid_output",
      },
    });
    return {
      ok: false,
      code: "invalid_output",
      message: "Model returned invalid JSON for product content schema",
    };
  }

  let finalLocales = firstValidated.locales;
  let finalWarnings = [...sourceWarnings, ...firstValidated.warnings];
  let secondUsage: ProviderUsage | null = null;

  if (editorPass) {
    try {
      const editorResult = await provider({
        system: buildEditorSystemInstruction(locales),
        user: buildEditorUserPrompt(facts, firstValidated.locales, locales),
        jsonSchema: PRODUCT_CONTENT_RESPONSE_SCHEMA as unknown as object,
        timeoutMs: GEMINI_TIMEOUT_MS,
      });
      secondUsage = editorResult.usage;

      const editorValidated = validateAndNormalizeDraftLocales(
        editorResult.json,
        facts,
        locales,
      );
      if (!editorValidated) {
        finalWarnings = [
          ...finalWarnings,
          { locale: "en", field: "description", message: "editor skipped" },
        ];
      } else {
        finalLocales = editorValidated.locales;
        finalWarnings = [...sourceWarnings, ...editorValidated.warnings];
      }
    } catch {
      finalWarnings = [
        ...finalWarnings,
        { locale: "en", field: "description", message: "editor skipped" },
      ];
    }
  }

  const combinedUsage = sumUsage(firstResult.usage, secondUsage);
  const costUsd = estimateCostUsd(
    combinedUsage.model,
    combinedUsage.inputTokens,
    combinedUsage.outputTokens,
  );

  await writeAiGenerationAudit({
    productId: product.id,
    adminUsername: input.actor.username,
    adminSessionId: input.actor.sessionId,
    usage: {
      model: combinedUsage.model,
      inputTokens: combinedUsage.inputTokens,
      outputTokens: combinedUsage.outputTokens,
      costUsd,
      latencyMs: combinedUsage.latencyMs,
      productId: product.id,
      locales,
      outcome: "ok",
    },
  });

  return {
    ok: true,
    draft: {
      productId: product.id,
      sourceUpdatedAt: product.updatedAt.toISOString(),
      locales: finalLocales,
      warnings: finalWarnings,
      usage: {
        model: combinedUsage.model,
        inputTokens: combinedUsage.inputTokens,
        outputTokens: combinedUsage.outputTokens,
        costUsd,
        latencyMs: combinedUsage.latencyMs,
      },
    },
  };
}
