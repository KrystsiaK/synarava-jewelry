import { randomUUID } from "node:crypto";

import { Prisma } from "@prisma/client";

import {
  AI_MARKETING_IDEAS_AUDIT_ACTION,
  estimateCostUsd,
  estimateCeilingCostUsd,
  getAiContentModel,
  getRateLimitOpts,
  GEMINI_TIMEOUT_MS,
  isAiContentEnabled,
} from "@/lib/ai/config";
import { assertMonthlyBudgetAvailable } from "@/lib/ai/product-content/budget";
import {
  buildProductContentFacts,
  factsCorpus,
  scrubPromptInjectionFromFacts,
  type ProductForFacts,
} from "@/lib/ai/product-content/facts";
import {
  ContentProviderNotConfiguredError,
  getContentProvider,
} from "@/lib/ai/product-content/provider";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import { db } from "@/lib/db";
import { validateManualNotes } from "@/lib/marketing/ideas/notes";
import { MARKETING_IDEAS_RESPONSE_SCHEMA } from "@/lib/marketing/ideas/schema";
import {
  plannedForFromWeekSlot,
  validateMarketingIdeas,
  type ValidatedMarketingIdea,
} from "@/lib/marketing/ideas/validate";
import {
  fromCompetitorObservation,
  fromManualNote,
  type MarketSignal,
} from "@/lib/marketing/signals";
import { shopifyProductSpecValuesFromWindows } from "@/lib/products/shopify-product-specs";

export type GenerateMarketingIdeasInput = {
  productIds: string[];
  signalIds?: string[];
  manualNotes?: Array<{ url: string; text: string }>;
  actor: { username: string; sessionId: string };
};

export type GenerateMarketingIdeasResult =
  | {
      ok: true;
      ideas: Array<ValidatedMarketingIdea & { id: string; plannedFor: Date }>;
      warnings: string[];
      usage: { costUsd: number; model: string };
    }
  | {
      ok: false;
      code:
        | "unauthorized"
        | "disabled"
        | "not_configured"
        | "rate_limited"
        | "budget_exhausted"
        | "invalid_input"
        | "not_found"
        | "provider_error"
        | "invalid_output";
      message: string;
    };

const productSelect = {
  id: true,
  name: true,
  productType: true,
  materialLine: true,
  shortDescription: true,
  description: true,
  seoTitle: true,
  seoDescription: true,
  symbolismLabel: true,
  symbolismTitle: true,
  symbolismBody: true,
  symbolismBody2: true,
  details: true,
  extras: true,
  shopifySnapshot: true,
  characteristics: {
    select: {
      key: true,
      label: true,
      textValue: true,
      numberValue: true,
      booleanValue: true,
      unit: true,
    },
    orderBy: { sortOrder: "asc" as const },
  },
  collections: {
    select: { collection: { select: { name: true } } },
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
} satisfies Prisma.ProductSelect;

function buildSystemInstruction(): string {
  return [
    "You generate Instagram Reels ideas for Synarava fashion jewelry.",
    "Use ONLY the provided product facts and market signals. Never invent materials, certifications, or competitor claims.",
    "Locales: en (English) and pt (European Portuguese / PT-PT).",
    "Return JSON matching the schema. Produce 12 ideas balanced across en and pt (about 6 each).",
    "Each idea: hook, script, shotList, caption, weekSlot 1-4, productIds from the input list, signalIds only from provided signal ids (may be empty).",
  ].join(" ");
}

function buildUserPrompt(input: {
  products: Array<{ id: string; factsText: string }>;
  signals: MarketSignal[];
}): string {
  const productBlock = input.products
    .map((p) => `### Product ${p.id}\n${p.factsText}`)
    .join("\n\n");
  const signalBlock =
    input.signals.length === 0
      ? "(none)"
      : input.signals
          .map(
            (s) =>
              `### Signal ${s.id}\nbrand=${s.brand} url=${s.url} change=${s.change}\n${s.summary}`,
          )
          .join("\n\n");
  return [
    "Generate 12 Reels ideas balanced across en and pt (about 6 each).",
    "",
    "## Products",
    productBlock,
    "",
    "## Market signals",
    signalBlock,
  ].join("\n");
}

type UsageAuditPayload = {
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
  outcome: "ok" | "invalid_output";
  ideaCount: number;
  manualNotes: Array<{ signalId: string; url: string; text: string }>;
};

async function writeUsageAudit(input: {
  actor: { username: string; sessionId: string };
  usage: UsageAuditPayload;
}): Promise<void> {
  await db.auditLog.create({
    data: {
      action: AI_MARKETING_IDEAS_AUDIT_ACTION,
      entityType: "CONTENT_IDEA",
      entityId: "batch",
      before: Prisma.JsonNull,
      after: Prisma.JsonNull,
      metadata: input.usage,
      adminUsername: input.actor.username,
      adminSessionId: input.actor.sessionId,
    },
  });
}

export async function generateMarketingIdeas(
  input: GenerateMarketingIdeasInput,
): Promise<GenerateMarketingIdeasResult> {
  if (!isAiContentEnabled()) {
    return { ok: false, code: "disabled", message: "AI content is disabled" };
  }

  const productIds = [...new Set(input.productIds.filter(Boolean))];
  if (productIds.length < 1 || productIds.length > 10) {
    return {
      ok: false,
      code: "invalid_input",
      message: "Provide 1–10 product ids",
    };
  }

  const notesCheck = validateManualNotes(input.manualNotes);
  if (!notesCheck.ok) {
    return { ok: false, code: "invalid_input", message: notesCheck.message };
  }

  const rl = await checkRateLimit(
    AI_MARKETING_IDEAS_AUDIT_ACTION,
    input.actor.sessionId,
    getRateLimitOpts(),
  );
  if (!rl.ok) {
    return { ok: false, code: "rate_limited", message: rl.error };
  }

  const products = await db.product.findMany({
    where: { id: { in: productIds } },
    select: productSelect,
  });
  if (products.length !== productIds.length) {
    return {
      ok: false,
      code: "not_found",
      message: "One or more products were not found",
    };
  }

  const requestedSignalIds = [...new Set((input.signalIds ?? []).filter(Boolean))];
  const webIds = requestedSignalIds
    .filter((id) => id.startsWith("web:"))
    .map((id) => id.slice(4));
  const observations =
    webIds.length > 0
      ? await db.competitorObservation.findMany({ where: { id: { in: webIds } } })
      : [];
  if (observations.length !== webIds.length) {
    return {
      ok: false,
      code: "invalid_input",
      message: "One or more signal ids were not found",
    };
  }

  const manualSignals = notesCheck.notes.map((note) => {
    const id = randomUUID();
    return fromManualNote({ id, url: note.url, text: note.text });
  });
  const manualNotesMeta = manualSignals.map((s) => ({
    signalId: s.id,
    url: s.url,
    text: String(s.data.text ?? s.summary),
  }));

  const signals: MarketSignal[] = [
    ...observations.map((row) => fromCompetitorObservation(row)),
    ...manualSignals,
  ];
  const allowedSignalIds = new Set(signals.map((s) => s.id));

  const productFactsCorpus = new Map<string, string>();
  const promptProducts: Array<{ id: string; factsText: string }> = [];
  for (const product of products) {
    const { extras, shopifySnapshot, ...rest } = product;
    const facts = buildProductContentFacts({
      ...(rest as ProductForFacts),
      enSpecs: shopifyProductSpecValuesFromWindows(extras, shopifySnapshot),
    });
    const scrubbed = scrubPromptInjectionFromFacts(facts);
    const corpus = factsCorpus(scrubbed.facts);
    productFactsCorpus.set(product.id, corpus.toLowerCase());
    promptProducts.push({
      id: product.id,
      factsText: corpus,
    });
  }

  const user = buildUserPrompt({ products: promptProducts, signals });
  const ceiling = estimateCeilingCostUsd(user.length);
  const budget = await assertMonthlyBudgetAvailable(ceiling);
  if (!budget.ok) {
    return {
      ok: false,
      code: "budget_exhausted",
      message: `Monthly AI budget exhausted (spent ${budget.spent} / ${budget.budget})`,
    };
  }

  let providerResult: Awaited<ReturnType<ReturnType<typeof getContentProvider>>> | null =
    null;
  try {
    const provider = getContentProvider();
    providerResult = await provider({
      system: buildSystemInstruction(),
      user,
      jsonSchema: MARKETING_IDEAS_RESPONSE_SCHEMA,
      timeoutMs: GEMINI_TIMEOUT_MS,
    });
  } catch (error) {
    if (error instanceof ContentProviderNotConfiguredError) {
      return { ok: false, code: "not_configured", message: error.message };
    }
    return {
      ok: false,
      code: "provider_error",
      message: "Provider failed to generate marketing ideas",
    };
  }

  const costUsd = estimateCostUsd(
    providerResult.usage.model || getAiContentModel(),
    providerResult.usage.inputTokens,
    providerResult.usage.outputTokens,
  );

  const validated = validateMarketingIdeas({
    rawIdeas: providerResult.json,
    allowedProductIds: new Set(productIds),
    allowedSignalIds,
    productFactsCorpus,
    signals,
  });

  let usageOutcome: "ok" | "invalid_output" = "invalid_output";
  let created: Array<ValidatedMarketingIdea & { id: string; plannedFor: Date }> =
    [];
  let createError: Error | null = null;

  try {
    if (validated.ideas.length === 0) {
      return {
        ok: false,
        code: "invalid_output",
        message: validated.warnings.join("; ") || "No valid ideas returned",
      };
    }

    const now = new Date();
    created = await db.$transaction(async (tx) => {
      const rows: Array<ValidatedMarketingIdea & { id: string; plannedFor: Date }> =
        [];
      for (const idea of validated.ideas) {
        const plannedFor = plannedForFromWeekSlot(idea.weekSlot, now);
        const row = await tx.contentIdea.create({
          data: {
            status: "draft",
            locale: idea.locale,
            productIds: idea.productIds,
            signalIds: idea.signalIds,
            hook: idea.hook,
            script: idea.script,
            shotList: idea.shotList,
            caption: idea.caption,
            plannedFor,
          },
        });
        rows.push({ ...idea, id: row.id, plannedFor });
      }
      return rows;
    });
    usageOutcome = "ok";
  } catch (error) {
    createError = error instanceof Error ? error : new Error("idea create failed");
  } finally {
    if (providerResult) {
      await writeUsageAudit({
        actor: input.actor,
        usage: {
          model: providerResult.usage.model || getAiContentModel(),
          inputTokens: providerResult.usage.inputTokens,
          outputTokens: providerResult.usage.outputTokens,
          costUsd,
          latencyMs: providerResult.usage.latencyMs,
          outcome: usageOutcome,
          ideaCount: created.length,
          manualNotes: manualNotesMeta,
        },
      });
    }
  }

  if (createError) {
    return {
      ok: false,
      code: "provider_error",
      message: "Failed to persist content ideas after generation",
    };
  }

  if (usageOutcome !== "ok") {
    return {
      ok: false,
      code: "invalid_output",
      message: validated.warnings.join("; ") || "No valid ideas returned",
    };
  }

  const warnings = [...validated.warnings];
  if (created.length < 10) {
    warnings.push(`only ${created.length} valid ideas`);
  }

  return {
    ok: true,
    ideas: created,
    warnings,
    usage: { costUsd, model: providerResult.usage.model || getAiContentModel() },
  };
}
