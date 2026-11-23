import { Prisma } from "@prisma/client";

import {
  AI_AUDIT_ACTION,
  AI_BUDGET_AUDIT_ACTIONS,
  getMonthlyBudgetUsd,
} from "@/lib/ai/config";
import { db } from "@/lib/db";

function monthWindow(now = new Date()): { start: Date; end: Date } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));
  return { start, end };
}

function costFromMetadata(metadata: unknown): number {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return 0;
  const cost = (metadata as Record<string, unknown>).costUsd;
  return typeof cost === "number" && Number.isFinite(cost) && cost > 0 ? cost : 0;
}

/** Sum costUsd from AuditLog rows for the current UTC month (all AI budget actions). */
export async function sumMonthlyAiSpendUsd(now = new Date()): Promise<number> {
  const { start, end } = monthWindow(now);
  const rows = await db.auditLog.findMany({
    where: {
      action: { in: [...AI_BUDGET_AUDIT_ACTIONS] },
      createdAt: { gte: start, lt: end },
    },
    select: { metadata: true },
  });
  return rows.reduce((sum, row) => sum + costFromMetadata(row.metadata), 0);
}

export async function assertMonthlyBudgetAvailable(
  estimatedAdditionalUsd = 0,
): Promise<{ ok: true } | { ok: false; spent: number; budget: number }> {
  const budget = getMonthlyBudgetUsd();
  const spent = await sumMonthlyAiSpendUsd();
  if (spent + estimatedAdditionalUsd > budget) {
    return { ok: false, spent, budget };
  }
  return { ok: true };
}

export type AiAuditOutcome = "ok" | "invalid_output";

export type AiUsageAuditMetadata = {
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
  productId: string;
  locales: string[];
  /** Present whenever the provider returned usage (success or invalid_output). */
  outcome: AiAuditOutcome;
};

/** Sole DB write for AI generation — usage only, never product texts. */
export async function writeAiGenerationAudit(input: {
  productId: string;
  adminUsername: string | null;
  adminSessionId: string | null;
  usage: AiUsageAuditMetadata;
}): Promise<void> {
  await db.auditLog.create({
    data: {
      action: AI_AUDIT_ACTION,
      entityType: "PRODUCT",
      entityId: input.productId,
      before: Prisma.JsonNull,
      after: Prisma.JsonNull,
      metadata: input.usage,
      adminUsername: input.adminUsername,
      adminSessionId: input.adminSessionId,
    },
  });
}
