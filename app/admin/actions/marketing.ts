"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { writeAuditLog } from "@/app/admin/actions/shared";
import { requireAdminSession } from "@/lib/auth/admin-session";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import { db } from "@/lib/db";
import {
  persistCalendarSync,
  syncContentIdeaCalendar,
} from "@/lib/marketing/calendar/apply-sync";
import { isGoogleCalendarSyncEnabled } from "@/lib/marketing/calendar/config";
import {
  scanAllCompetitors,
  truncateScanErrors,
} from "@/lib/marketing/competitors/collect";
import {
  buildObservationsCsv,
  periodStartDate,
  type ExportPeriod,
  type ObservationCsvRow,
} from "@/lib/marketing/export/csv";
import {
  isGoogleSheetsExportEnabled,
  overwriteCompetitorGoogleSheet,
} from "@/lib/marketing/export/sheets";
import { generateMarketingIdeas } from "@/lib/marketing/ideas/generate";
import { presentContentIdea } from "@/lib/marketing/ideas/present";
import { COMPETITOR_TARGETS } from "@/lib/marketing/competitors/targets";
import { listCompetitorObservations } from "@/lib/marketing/queries";

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
  productIds: string[];
  signalIds: string[];
  whyRu: string;
  hook: unknown;
  script: string;
  shotList: unknown;
  caption: unknown;
  plannedFor: Date | null;
  calendarEventId?: string | null;
  calendarSyncedAt?: Date | null;
  calendarSyncError?: string | null;
}) {
  return presentContentIdea(row);
}

async function runCalendarSyncSafe(input: {
  idea: {
    id: string;
    status: string;
    productIds: string[];
    script: string;
    shotList: unknown;
    hook: unknown;
    plannedFor: Date | null;
    calendarEventId: string | null;
  };
  op: "upsert" | "delete";
}) {
  try {
    const { result, patch } = await syncContentIdeaCalendar(input);
    return await persistCalendarSync({
      ideaId: input.idea.id,
      result,
      patch,
      writeAudit: writeAuditLog,
    });
  } catch {
    // Google / audit failure must never block approve/reject/edit.
    const error = "Calendar sync failed";
    try {
      const updated = await db.contentIdea.update({
        where: { id: input.idea.id },
        data: { calendarSyncError: error },
      });
      await writeAuditLog({
        action: "marketing.idea.calendar_sync",
        entityType: "CONTENT_IDEA",
        entityId: input.idea.id,
        before: {
          calendarEventId: input.idea.calendarEventId,
          calendarSyncError: null,
        },
        after: {
          calendarEventId: updated.calendarEventId,
          calendarSyncError: updated.calendarSyncError,
        },
        metadata: { ok: false, action: input.op, error },
      });
      return {
        calendarEventId: updated.calendarEventId,
        calendarSyncedAt: updated.calendarSyncedAt?.toISOString() ?? null,
        calendarSyncError: updated.calendarSyncError,
      };
    } catch {
      return {
        calendarEventId: input.idea.calendarEventId,
        calendarSyncedAt: null,
        calendarSyncError: error,
      };
    }
  }
}

export type LocalizedCopyInput = { en: string; pt: string };

export type UpdateContentIdeaInput = {
  id: string;
  whyRu?: string;
  hook?: LocalizedCopyInput;
  script?: string;
  shotList?: string[];
  caption?: LocalizedCopyInput;
  plannedFor?: string | null;
};

function isLocalizedCopy(value: unknown): value is LocalizedCopyInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return typeof record.en === "string" && typeof record.pt === "string";
}

export async function googleCalendarSyncEnabledAction() {
  const auth = await requireMarketingAdmin();
  if (!auth.ok) return { ...auth, enabled: false as const };
  return { ok: true as const, enabled: isGoogleCalendarSyncEnabled() };
}

export async function updateContentIdeaAction(input: UpdateContentIdeaInput) {
  const auth = await requireMarketingAdmin();
  if (!auth.ok) return auth;

  const existing = await db.contentIdea.findUnique({ where: { id: input.id } });
  if (!existing) {
    return { ok: false as const, code: "not_found" as const, message: "Idea not found" };
  }

  const data: Prisma.ContentIdeaUpdateInput = {};
  if (typeof input.whyRu === "string") data.whyRu = input.whyRu;
  if (isLocalizedCopy(input.hook)) data.hook = input.hook;
  if (typeof input.script === "string") data.script = input.script;
  if (Array.isArray(input.shotList)) data.shotList = input.shotList;
  if (isLocalizedCopy(input.caption)) data.caption = input.caption;
  let plannedForChanged = false;
  if (input.plannedFor === null) {
    data.plannedFor = null;
    plannedForChanged = existing.plannedFor != null;
  } else if (typeof input.plannedFor === "string" && input.plannedFor) {
    const d = new Date(input.plannedFor);
    if (!Number.isNaN(d.getTime())) {
      data.plannedFor = d;
      plannedForChanged =
        !existing.plannedFor ||
        existing.plannedFor.toISOString() !== d.toISOString();
    }
  }

  let updated = await db.contentIdea.update({
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

  if (
    updated.status === "approved" &&
    plannedForChanged &&
    updated.plannedFor
  ) {
    const syncFields = await runCalendarSyncSafe({
      idea: updated,
      op: "upsert",
    });
    updated = { ...updated, ...{
      calendarEventId: syncFields.calendarEventId,
      calendarSyncedAt: syncFields.calendarSyncedAt
        ? new Date(syncFields.calendarSyncedAt)
        : updated.calendarSyncedAt,
      calendarSyncError: syncFields.calendarSyncError,
    }};
  }

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

  let updated = await db.contentIdea.update({
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

  const syncFields = await runCalendarSyncSafe({
    idea: updated,
    op: "upsert",
  });
  updated = {
    ...updated,
    calendarEventId: syncFields.calendarEventId,
    calendarSyncedAt: syncFields.calendarSyncedAt
      ? new Date(syncFields.calendarSyncedAt)
      : updated.calendarSyncedAt,
    calendarSyncError: syncFields.calendarSyncError,
  };

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

  let updated = await db.contentIdea.update({
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

  const syncFields = await runCalendarSyncSafe({
    idea: { ...updated, calendarEventId: existing.calendarEventId },
    op: "delete",
  });
  updated = {
    ...updated,
    calendarEventId: syncFields.calendarEventId,
    calendarSyncedAt: syncFields.calendarSyncedAt
      ? new Date(syncFields.calendarSyncedAt)
      : null,
    calendarSyncError: syncFields.calendarSyncError,
  };

  revalidatePath("/admin/marketing");
  return { ok: true as const, idea: ideaSnapshot(updated) };
}

/** Retry Google Calendar sync for an approved idea. */
export async function retryCalendarSyncAction(id: string) {
  const auth = await requireMarketingAdmin();
  if (!auth.ok) return auth;

  const existing = await db.contentIdea.findUnique({ where: { id } });
  if (!existing) {
    return { ok: false as const, code: "not_found" as const, message: "Idea not found" };
  }
  if (existing.status !== "approved" || !existing.plannedFor) {
    return {
      ok: false as const,
      code: "invalid_input" as const,
      message: "Only approved scheduled ideas can sync",
    };
  }

  const syncFields = await runCalendarSyncSafe({
    idea: existing,
    op: "upsert",
  });
  const updated = {
    ...existing,
    calendarEventId: syncFields.calendarEventId,
    calendarSyncedAt: syncFields.calendarSyncedAt
      ? new Date(syncFields.calendarSyncedAt)
      : existing.calendarSyncedAt,
    calendarSyncError: syncFields.calendarSyncError,
  };
  revalidatePath("/admin/marketing");
  return { ok: true as const, idea: ideaSnapshot(updated) };
}

function toCsvRow(row: {
  brand: string;
  domain: string;
  url: string;
  fetchedAt: Date;
  kind: string;
  price: string | null;
  currency: string | null;
  availability: string | null;
  source: string;
  name: string | null;
}): ObservationCsvRow {
  return {
    brand: row.brand,
    domain: row.domain,
    url: row.url,
    fetchedAt: row.fetchedAt.toISOString(),
    kind: row.kind,
    price: row.price,
    currency: row.currency,
    availability: row.availability,
    source: row.source,
    name: row.name,
  };
}

export async function googleSheetsExportEnabledAction() {
  const auth = await requireMarketingAdmin();
  if (!auth.ok) return { ...auth, enabled: false as const };
  return { ok: true as const, enabled: isGoogleSheetsExportEnabled() };
}

export async function downloadObservationsCsvAction(input: {
  kind?: "all" | "initial" | "changed" | "removed";
  period?: ExportPeriod;
}) {
  const auth = await requireMarketingAdmin();
  if (!auth.ok) return auth;

  const period = input.period ?? "all";
  const since = periodStartDate(period);
  const rows = await listCompetitorObservations({
    kind: input.kind ?? "all",
    since,
    take: 10_000,
  });
  const csv = buildObservationsCsv(rows.map(toCsvRow));
  return {
    ok: true as const,
    csv,
    rowCount: rows.length,
    filename: `competitors-${period}-${new Date().toISOString().slice(0, 10)}.csv`,
  };
}

export async function exportObservationsToGoogleSheetAction() {
  const auth = await requireMarketingAdmin();
  if (!auth.ok) return auth;

  if (!isGoogleSheetsExportEnabled()) {
    return {
      ok: false as const,
      code: "disabled" as const,
      message: "Google Sheets export is not configured",
    };
  }

  const since = periodStartDate("90");
  const rows = await listCompetitorObservations({
    kind: "all",
    since,
    take: 10_000,
  });
  const observations = rows.map(toCsvRow);
  const summarySource = rows.map((row) => ({
    brand: row.brand,
    domain: row.domain,
    url: row.url,
    kind: row.kind,
    price: row.price != null ? Number(row.price) : null,
    fetchedAt: row.fetchedAt.toISOString(),
  }));

  const result = await overwriteCompetitorGoogleSheet({
    observations,
    summarySource,
  });
  if (!result.ok) {
    return {
      ok: false as const,
      code: "error" as const,
      message: result.error,
    };
  }

  await writeAuditLog({
    action: "marketing.competitors.sheet_export",
    entityType: "COMPETITOR_OBSERVATION",
    entityId: "sheet_export",
    before: null,
    after: {
      observationRows: result.observationRows,
      summaryRows: result.summaryRows,
    },
    metadata: {
      observationRows: result.observationRows,
      summaryRows: result.summaryRows,
    },
  });
  return {
    ok: true as const,
    observationRows: result.observationRows,
    summaryRows: result.summaryRows,
  };
}
