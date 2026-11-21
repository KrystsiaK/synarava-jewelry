import { checkRateLimit } from "@/lib/auth/rate-limit";
import {
  estimateCostUsd,
  getRateLimitOpts,
  GEMINI_TIMEOUT_MS,
  isAiContentEnabled,
} from "@/lib/ai/config";
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
  ContentProviderNotConfiguredError,
  getContentProvider,
  type ContentProvider,
} from "@/lib/ai/product-content/provider";
import {
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
 * Uses ContentProvider stub until architect picks the benchmark winner.
 */
export async function generateProductContent(input: {
  productId: string;
  locales: AiLocale[];
  actor: AdminActor;
  /** Optional override (tests / future wiring). Defaults to getContentProvider(). */
  provider?: ContentProvider;
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
  const provider = input.provider ?? getContentProvider();

  let providerResult: Awaited<ReturnType<ContentProvider>>;
  try {
    providerResult = await provider({
      system: buildSystemInstruction(locales),
      user: buildUserPrompt(facts, locales),
      jsonSchema: PRODUCT_CONTENT_RESPONSE_SCHEMA as unknown as object,
      timeoutMs: GEMINI_TIMEOUT_MS,
    });
  } catch (error) {
    return mapProviderError(error);
  }

  const costUsd = estimateCostUsd(
    providerResult.usage.model,
    providerResult.usage.inputTokens,
    providerResult.usage.outputTokens,
  );

  const validated = validateAndNormalizeDraftLocales(
    providerResult.json,
    facts,
    locales,
  );

  // If the provider returned usage, always AuditLog — including invalid_output —
  // so costUsd counts toward the monthly budget sum.
  await writeAiGenerationAudit({
    productId: product.id,
    adminUsername: input.actor.username,
    adminSessionId: input.actor.sessionId,
    usage: {
      model: providerResult.usage.model,
      inputTokens: providerResult.usage.inputTokens,
      outputTokens: providerResult.usage.outputTokens,
      costUsd,
      latencyMs: providerResult.usage.latencyMs,
      productId: product.id,
      locales,
      outcome: validated ? "ok" : "invalid_output",
    },
  });

  if (!validated) {
    return {
      ok: false,
      code: "invalid_output",
      message: "Model returned invalid JSON for product content schema",
    };
  }

  return {
    ok: true,
    draft: {
      productId: product.id,
      sourceUpdatedAt: product.updatedAt.toISOString(),
      locales: validated.locales,
      warnings: validated.warnings,
      usage: {
        model: providerResult.usage.model,
        inputTokens: providerResult.usage.inputTokens,
        outputTokens: providerResult.usage.outputTokens,
        costUsd,
        latencyMs: providerResult.usage.latencyMs,
      },
    },
  };
}
