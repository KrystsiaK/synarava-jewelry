import { db } from "@/lib/db";
import {
  COMPETITOR_TARGETS,
  normalizeCompetitorHost,
} from "@/lib/marketing/competitors/targets";

export type ObservationKindFilter = "all" | "initial" | "changed" | "removed";

export type LastScanDomainSummary = {
  domain: string;
  fetched: number;
  written: number;
  unparsed: number;
  skippedRobots: number;
  sitemapComplete: boolean;
  firstError: string | null;
};

export type LastScanSummary = {
  createdAt: string;
  writtenTotal: number;
  unparsedTotal: number;
  durationMs: number;
  truncated: boolean;
  domains: LastScanDomainSummary[];
};

function brandForDomain(domain: string): string {
  const host = normalizeCompetitorHost(domain);
  return COMPETITOR_TARGETS.find((t) => t.host === host)?.label ?? domain;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asFiniteNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

/** Latest `marketing.competitors.scan` AuditLog after payload for the admin UI. */
export async function getLastCompetitorScanSummary(): Promise<LastScanSummary | null> {
  const row = await db.auditLog.findFirst({
    where: { action: "marketing.competitors.scan" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true, after: true },
  });
  if (!row) return null;
  const after = asRecord(row.after);
  if (!after) return null;
  const rawDomains = Array.isArray(after.domains) ? after.domains : [];
  const domains: LastScanDomainSummary[] = rawDomains.flatMap((item) => {
    const d = asRecord(item);
    if (!d || typeof d.domain !== "string") return [];
    const errors = Array.isArray(d.errors)
      ? d.errors.filter((e): e is string => typeof e === "string")
      : [];
    return [
      {
        domain: d.domain,
        fetched: asFiniteNumber(d.fetched),
        written: asFiniteNumber(d.written),
        unparsed: asFiniteNumber(d.unparsed),
        skippedRobots: asFiniteNumber(d.skippedRobots),
        sitemapComplete: asBoolean(d.sitemapComplete),
        firstError: errors[0] ?? null,
      },
    ];
  });
  return {
    createdAt: row.createdAt.toISOString(),
    writtenTotal: asFiniteNumber(after.writtenTotal),
    unparsedTotal: asFiniteNumber(after.unparsedTotal),
    durationMs: asFiniteNumber(after.durationMs),
    truncated: asBoolean(after.truncated),
    domains,
  };
}

export async function listCompetitorObservations(input?: {
  kind?: ObservationKindFilter;
  take?: number;
}) {
  const kind = input?.kind && input.kind !== "all" ? input.kind : undefined;
  const rows = await db.competitorObservation.findMany({
    where: kind ? { kind } : undefined,
    orderBy: { fetchedAt: "desc" },
    take: input?.take ?? 200,
  });
  return rows.map((row) => ({
    ...row,
    brand: brandForDomain(row.domain),
    price: row.price?.toString() ?? null,
  }));
}

export async function listContentIdeas(input?: {
  status?: "draft" | "approved" | "rejected";
}) {
  return db.contentIdea.findMany({
    where: input?.status ? { status: input.status } : undefined,
    orderBy: [{ plannedFor: "asc" }, { createdAt: "desc" }],
    take: 200,
  });
}

/** Approved ideas grouped by ISO week of plannedFor (UTC). */
export async function listApprovedIdeasCalendar() {
  const ideas = await db.contentIdea.findMany({
    where: { status: "approved", plannedFor: { not: null } },
    orderBy: { plannedFor: "asc" },
  });

  const groups = new Map<
    string,
    { weekKey: string; weekStart: Date; ideas: typeof ideas }
  >();

  for (const idea of ideas) {
    if (!idea.plannedFor) continue;
    const d = idea.plannedFor;
    const day = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const dow = day.getUTCDay() || 7;
    day.setUTCDate(day.getUTCDate() - dow + 1);
    const weekKey = day.toISOString().slice(0, 10);
    const existing = groups.get(weekKey);
    if (existing) {
      existing.ideas.push(idea);
    } else {
      groups.set(weekKey, { weekKey, weekStart: day, ideas: [idea] });
    }
  }

  return [...groups.values()];
}

export async function listProductOptionsForMarketing() {
  const rows = await db.product.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: 200,
  });
  return rows;
}
