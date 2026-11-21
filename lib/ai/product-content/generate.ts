import { checkRateLimit } from "@/lib/auth/rate-limit";
import {
  getRateLimitOpts,
  isAiContentEnabled,
} from "@/lib/ai/config";
import { generateStructuredJson } from "@/lib/ai/gemini";
import {
  assertMonthlyBudgetAvailable,
  writeAiGenerationAudit,
} from "@/lib/ai/product-content/budget";
import type {
  AiLocale,
  GenerateResult,
} from "@/lib/ai/product-content/contract";
import {
  buildProductContentFacts,
  type ProductForFacts,
} from "@/lib/ai/product-content/facts";
import {
  buildSystemInstruction,
  buildUserPrompt,
  PRODUCT_CONTENT_RESPONSE_SCHEMA,
} from "@/lib/ai/product-content/prompt";
import { validateAndNormalizeDraftLocales } from "@/lib/ai/product-content/validate";
import { db } from "@/lib/db";

const VALID_LOCALES = new Set<AiLocale>(["en", "pt", "ru"]);

export type AdminActor = {
  username: string;
  sessionId: string;
};

function normalizeLocales(locales: AiLocale[]): AiLocale[] {
  const unique: AiLocale[] = [];
  for (const locale of locales) {
    if (!VALID_LOCALES.has(locale)) continue;
    if (!unique.includes(locale)) unique.push(locale);
  }
  return unique;
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

/**
 * Core generate flow (read-only Product load; sole write = AuditLog).
 */
export async function generateProductContent(input: {
  productId: string;
  locales: AiLocale[];
  actor: AdminActor;
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

  const budget = await assertMonthlyBudgetAvailable();
  if (!budget.ok) {
    return {
      ok: false,
      code: "budget_exhausted",
      message: `Monthly AI budget exhausted (spent $${budget.spent.toFixed(4)} / $${budget.budget})`,
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

  const facts = buildProductContentFacts(product);
  const gemini = await generateStructuredJson({
    systemInstruction: buildSystemInstruction(locales),
    userPrompt: buildUserPrompt(facts, locales),
    responseJsonSchema: PRODUCT_CONTENT_RESPONSE_SCHEMA as unknown as Record<string, unknown>,
  });

  if (!gemini.ok) {
    return {
      ok: false,
      code: gemini.code === "disabled" ? "disabled" : gemini.code,
      message: gemini.message,
    };
  }

  const validated = validateAndNormalizeDraftLocales(gemini.text, facts, locales);
  if (!validated) {
    return {
      ok: false,
      code: "invalid_output",
      message: "Model returned invalid JSON for product content schema",
    };
  }

  await writeAiGenerationAudit({
    productId: product.id,
    adminUsername: input.actor.username,
    adminSessionId: input.actor.sessionId,
    usage: {
      model: gemini.model,
      inputTokens: gemini.inputTokens,
      outputTokens: gemini.outputTokens,
      costUsd: gemini.costUsd,
      latencyMs: gemini.latencyMs,
      productId: product.id,
      locales,
    },
  });

  return {
    ok: true,
    draft: {
      productId: product.id,
      sourceUpdatedAt: product.updatedAt.toISOString(),
      locales: validated.locales,
      warnings: validated.warnings,
      usage: {
        model: gemini.model,
        inputTokens: gemini.inputTokens,
        outputTokens: gemini.outputTokens,
        costUsd: gemini.costUsd,
        latencyMs: gemini.latencyMs,
      },
    },
  };
}
