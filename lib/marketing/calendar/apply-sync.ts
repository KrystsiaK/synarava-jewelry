import { Prisma } from "@prisma/client";

import {
  syncIdeaToGoogleCalendar,
  type CalendarSyncResult,
} from "@/lib/marketing/calendar/google-sync";
import { normalizeLocalizedCopy } from "@/lib/marketing/ideas/localized";
import { db } from "@/lib/db";

export type ContentIdeaSyncRow = {
  id: string;
  status: string;
  productIds: string[];
  script: string;
  shotList: unknown;
  hook: unknown;
  plannedFor: Date | null;
  calendarEventId: string | null;
};

async function productNameMap(productIds: string[]): Promise<Map<string, string>> {
  if (productIds.length === 0) return new Map();
  const rows = await db.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true },
  });
  return new Map(rows.map((r) => [r.id, r.name]));
}

function shotListOf(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((s): s is string => typeof s === "string")
    : [];
}

export function calendarFieldsFromSyncResult(
  result: CalendarSyncResult,
  now = new Date(),
): Prisma.ContentIdeaUpdateInput {
  if (result.ok && result.skipped) {
    return {};
  }
  if (result.ok) {
    return {
      calendarEventId: result.eventId,
      calendarSyncedAt: now,
      calendarSyncError: null,
    };
  }
  return {
    calendarSyncError: result.error,
  };
}

export async function syncContentIdeaCalendar(input: {
  idea: ContentIdeaSyncRow;
  op: "upsert" | "delete";
  fetchFn?: typeof fetch;
  env?: NodeJS.ProcessEnv;
}): Promise<{
  result: CalendarSyncResult;
  patch: Prisma.ContentIdeaUpdateInput;
}> {
  if (!input.idea.plannedFor && input.op === "upsert") {
    const result: CalendarSyncResult = {
      ok: false,
      action: input.idea.calendarEventId ? "patch" : "insert",
      eventId: input.idea.calendarEventId,
      error: "plannedFor required for calendar sync",
    };
    return { result, patch: calendarFieldsFromSyncResult(result) };
  }

  const productNameById = await productNameMap(input.idea.productIds);
  const result = await syncIdeaToGoogleCalendar({
    idea: {
      id: input.idea.id,
      productIds: input.idea.productIds,
      script: input.idea.script,
      shotList: shotListOf(input.idea.shotList),
      hook: normalizeLocalizedCopy(input.idea.hook),
      plannedFor: input.idea.plannedFor ?? new Date(),
      calendarEventId: input.idea.calendarEventId,
    },
    productNameById,
    op: input.op,
    fetchFn: input.fetchFn,
    env: input.env,
  });

  return { result, patch: calendarFieldsFromSyncResult(result) };
}

/** Persist sync fields + AuditLog. Never throws to caller for Google failures. */
export async function persistCalendarSync(input: {
  ideaId: string;
  result: CalendarSyncResult;
  patch: Prisma.ContentIdeaUpdateInput;
  writeAudit: (payload: {
    action: string;
    entityType: "CONTENT_IDEA";
    entityId: string;
    before: unknown;
    after: unknown;
    metadata?: unknown;
  }) => Promise<void>;
}): Promise<{
  calendarEventId: string | null;
  calendarSyncedAt: string | null;
  calendarSyncError: string | null;
}> {
  const existing = await db.contentIdea.findUnique({ where: { id: input.ideaId } });
  if (!existing) {
    return {
      calendarEventId: null,
      calendarSyncedAt: null,
      calendarSyncError: "idea not found",
    };
  }

  const updated =
    Object.keys(input.patch).length === 0
      ? existing
      : await db.contentIdea.update({
          where: { id: input.ideaId },
          data: input.patch,
        });

  const metadata = {
    ok: input.result.ok,
    skipped: "skipped" in input.result ? input.result.skipped : false,
    action:
      "action" in input.result
        ? input.result.action
        : "skipped" in input.result
          ? "skipped"
          : "unknown",
    eventId:
      "eventId" in input.result ? input.result.eventId : existing.calendarEventId,
    error: input.result.ok ? null : input.result.error,
  };

  await input.writeAudit({
    action: "marketing.idea.calendar_sync",
    entityType: "CONTENT_IDEA",
    entityId: input.ideaId,
    before: {
      calendarEventId: existing.calendarEventId,
      calendarSyncedAt: existing.calendarSyncedAt?.toISOString() ?? null,
      calendarSyncError: existing.calendarSyncError,
    },
    after: {
      calendarEventId: updated.calendarEventId,
      calendarSyncedAt: updated.calendarSyncedAt?.toISOString() ?? null,
      calendarSyncError: updated.calendarSyncError,
    },
    metadata,
  });

  return {
    calendarEventId: updated.calendarEventId,
    calendarSyncedAt: updated.calendarSyncedAt?.toISOString() ?? null,
    calendarSyncError: updated.calendarSyncError,
  };
}
