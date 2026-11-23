"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { writeAuditLog } from "@/app/admin/actions/shared";
import { requireAdminSession } from "@/lib/auth/admin-session";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import { db } from "@/lib/db";
import {
  scanAllCompetitors,
  truncateScanErrors,
} from "@/lib/marketing/competitors/collect";
import { generateMarketingIdeas } from "@/lib/marketing/ideas/generate";
import { COMPETITOR_TARGETS } from "@/lib/marketing/competitors/targets";

function isNextRedirectError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const digest = (error as { digest?: unknown }).digest;
  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT");
}

async function requireMarketingAdmin(): Promise<
  | { ok: true; session: { username: string; sessionId: string } }
  | { ok: false; code: "unauthorized"; message: string }
> {
  try {
    const session = await requireAdminSession();
    return { ok: true, session };
  } catch (error) {
    if (isNextRedirectError(error) || error instanceof Error) {
      return { ok: false, code: "unauthorized", message: "Admin session required" };
    }
    return { ok: false, code: "unauthorized", message: "Admin session required" };
  }
}

export type ScanDomainSummary = {
  domain: string;
  written: number;
  fetched: number;
  unparsed: number;
  skippedRobots: number;
  sitemapComplete: boolean;
  errors: string[];
  firstError: string | null;
};

export type ScanCompetitorsActionResult =
  | {
      ok: true;
      writtenTotal: number;
      unparsedTotal: number;
      durationMs: number;
      domains: ScanDomainSummary[];
    }
  | { ok: false; code: "unauthorized" | "rate_limited" | "error"; message: string };

function toDomainSummary(d: {
  domain: string;
  written: number;
  fetched: number;
  unparsed: number;
  skippedRobots: number;
  sitemapComplete: boolean;
  errors: string[];
}): ScanDomainSummary {
  const errors = truncateScanErrors(d.errors);
  return {
    domain: d.domain,
    written: d.written,
    fetched: d.fetched,
    unparsed: d.unparsed,
    skippedRobots: d.skippedRobots,
    sitemapComplete: d.sitemapComplete,
    errors,
    firstError: errors[0] ?? null,
  };
}

/** Manual competitor scan — admin + 3/hour rate limit. */
export async function scanCompetitorsAction(): Promise<ScanCompetitorsActionResult> {
  const auth = await requireMarketingAdmin();
  if (!auth.ok) return auth;

  const rl = await checkRateLimit("marketing.competitors.scan", auth.session.sessionId, {
    max: 3,
    windowMs: 60 * 60 * 1000,
  });
  if (!rl.ok) {
    return { ok: false, code: "rate_limited", message: rl.error };
  }

  try {
    const result = await scanAllCompetitors();
    const domains = result.domains.map(toDomainSummary);
    await writeAuditLog({
      action: "marketing.competitors.scan",
      entityType: "COMPETITOR_OBSERVATION",
      entityId: "scan",
      before: null,
      after: {
        writtenTotal: result.writtenTotal,
        unparsedTotal: result.unparsedTotal,
        durationMs: result.durationMs,
        truncated: result.truncated,
        domains: domains.map((d) => ({
          domain: d.domain,
          written: d.written,
          fetched: d.fetched,
          unparsed: d.unparsed,
          skippedRobots: d.skippedRobots,
          sitemapComplete: d.sitemapComplete,
          errors: d.errors,
        })),
      },
      metadata: { domainCount: COMPETITOR_TARGETS.length },
    });
    revalidatePath("/admin/marketing");
    return {
      ok: true,
      writtenTotal: result.writtenTotal,
      unparsedTotal: result.unparsedTotal,
      durationMs: result.durationMs,
      domains,
    };
  } catch (error) {
    return {
      ok: false,
      code: "error",
      message: error instanceof Error ? error.message : "Scan failed",
    };
  }
}

export async function generateMarketingIdeasAction(input: {
  productIds: string[];
  signalIds?: string[];
  manualNotes?: Array<{ url: string; text: string }>;
}) {
  const auth = await requireMarketingAdmin();
  if (!auth.ok) return auth;

  const result = await generateMarketingIdeas({
    productIds: input.productIds,
    signalIds: input.signalIds,
    manualNotes: input.manualNotes,
    actor: {
      username: auth.session.username,
      sessionId: auth.session.sessionId,
    },
  });
  if (result.ok) revalidatePath("/admin/marketing");
  return result;
}

function ideaSnapshot(row: {
  id: string;
  status: string;
  locale: string;
  productIds: string[];
  signalIds: string[];
  hook: string;
  script: string;
  shotList: unknown;
  caption: string;
  plannedFor: Date | null;
}) {
  return {
    id: row.id,
    status: row.status,
    locale: row.locale,
    productIds: row.productIds,
    signalIds: row.signalIds,
    hook: row.hook,
    script: row.script,
    shotList: row.shotList,
    caption: row.caption,
    plannedFor: row.plannedFor?.toISOString() ?? null,
  };
}

export type UpdateContentIdeaInput = {
  id: string;
  hook?: string;
  script?: string;
  shotList?: string[];
  caption?: string;
  plannedFor?: string | null;
};

export async function updateContentIdeaAction(input: UpdateContentIdeaInput) {
  const auth = await requireMarketingAdmin();
  if (!auth.ok) return auth;

  const existing = await db.contentIdea.findUnique({ where: { id: input.id } });
  if (!existing) {
    return { ok: false as const, code: "not_found" as const, message: "Idea not found" };
  }

  const data: Prisma.ContentIdeaUpdateInput = {};
  if (typeof input.hook === "string") data.hook = input.hook;
  if (typeof input.script === "string") data.script = input.script;
  if (Array.isArray(input.shotList)) data.shotList = input.shotList;
  if (typeof input.caption === "string") data.caption = input.caption;
  if (input.plannedFor === null) data.plannedFor = null;
  else if (typeof input.plannedFor === "string" && input.plannedFor) {
    const d = new Date(input.plannedFor);
    if (!Number.isNaN(d.getTime())) data.plannedFor = d;
  }

  const updated = await db.contentIdea.update({
    where: { id: input.id },
    data,
  });

  await writeAuditLog({
    action: "marketing.idea.edit",
    entityType: "CONTENT_IDEA",
    entityId: updated.id,
    before: ideaSnapshot(existing),
    after: ideaSnapshot(updated),
  });
  revalidatePath("/admin/marketing");
  return { ok: true as const, idea: ideaSnapshot(updated) };
}

export async function approveContentIdeaAction(id: string) {
  const auth = await requireMarketingAdmin();
  if (!auth.ok) return auth;

  const existing = await db.contentIdea.findUnique({ where: { id } });
  if (!existing) {
    return { ok: false as const, code: "not_found" as const, message: "Idea not found" };
  }

  const updated = await db.contentIdea.update({
    where: { id },
    data: { status: "approved" },
  });
  await writeAuditLog({
    action: "marketing.idea.approve",
    entityType: "CONTENT_IDEA",
    entityId: updated.id,
    before: ideaSnapshot(existing),
    after: ideaSnapshot(updated),
  });
  revalidatePath("/admin/marketing");
  return { ok: true as const, idea: ideaSnapshot(updated) };
}

export async function rejectContentIdeaAction(id: string) {
  const auth = await requireMarketingAdmin();
  if (!auth.ok) return auth;

  const existing = await db.contentIdea.findUnique({ where: { id } });
  if (!existing) {
    return { ok: false as const, code: "not_found" as const, message: "Idea not found" };
  }

  const updated = await db.contentIdea.update({
    where: { id },
    data: { status: "rejected" },
  });
  await writeAuditLog({
    action: "marketing.idea.reject",
    entityType: "CONTENT_IDEA",
    entityId: updated.id,
    before: ideaSnapshot(existing),
    after: ideaSnapshot(updated),
  });
  revalidatePath("/admin/marketing");
  return { ok: true as const, idea: ideaSnapshot(updated) };
}
