import {
  normalizeLocalizedCopy,
  type LocalizedCopy,
} from "@/lib/marketing/ideas/localized";

export type PresentedContentIdea = {
  id: string;
  status: string;
  productIds: string[];
  signalIds: string[];
  whyRu: string;
  hook: LocalizedCopy;
  script: string;
  shotList: string[];
  caption: LocalizedCopy;
  plannedFor: string | null;
  calendarEventId: string | null;
  calendarSyncedAt: string | null;
  calendarSyncError: string | null;
};

/** Map a ContentIdea DB row (new or legacy-shaped JSON) for admin UI. */
export function presentContentIdea(row: {
  id: string;
  status: string;
  productIds: string[];
  signalIds: string[];
  whyRu?: string | null;
  hook: unknown;
  script: string;
  shotList: unknown;
  caption: unknown;
  plannedFor: Date | string | null;
  calendarEventId?: string | null;
  calendarSyncedAt?: Date | string | null;
  calendarSyncError?: string | null;
  /** Pre-migration only; ignored when hook/caption are objects. */
  locale?: string | null;
}): PresentedContentIdea {
  const legacyLocale = row.locale ?? null;
  return {
    id: row.id,
    status: row.status,
    productIds: row.productIds,
    signalIds: row.signalIds,
    whyRu: typeof row.whyRu === "string" ? row.whyRu : "",
    hook: normalizeLocalizedCopy(row.hook, legacyLocale),
    script: row.script,
    shotList: Array.isArray(row.shotList)
      ? row.shotList.filter((s): s is string => typeof s === "string")
      : [],
    caption: normalizeLocalizedCopy(row.caption, legacyLocale),
    plannedFor:
      row.plannedFor instanceof Date
        ? row.plannedFor.toISOString()
        : typeof row.plannedFor === "string"
          ? row.plannedFor
          : null,
    calendarEventId: row.calendarEventId ?? null,
    calendarSyncedAt:
      row.calendarSyncedAt instanceof Date
        ? row.calendarSyncedAt.toISOString()
        : typeof row.calendarSyncedAt === "string"
          ? row.calendarSyncedAt
          : null,
    calendarSyncError: row.calendarSyncError ?? null,
  };
}
