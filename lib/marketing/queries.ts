import { db } from "@/lib/db";
import {
  COMPETITOR_TARGETS,
  normalizeCompetitorHost,
} from "@/lib/marketing/competitors/targets";

export type ObservationKindFilter = "all" | "initial" | "changed" | "removed";

function brandForDomain(domain: string): string {
  const host = normalizeCompetitorHost(domain);
  return COMPETITOR_TARGETS.find((t) => t.host === host)?.label ?? domain;
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
