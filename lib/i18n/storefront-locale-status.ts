import type { StorefrontLocaleStatus } from "@prisma/client";

/** Days a language must stay Retired before Delete data is allowed (Part B default). */
export const LOCALE_DELETE_RETENTION_DAYS = 30;

export type LocaleLifecycleState = "draft" | "published" | "retired" | "deleted";

export function isPublishedLocaleStatus(status: StorefrontLocaleStatus): boolean {
  return status === "PUBLISHED";
}

/** Derive denormalized `isPublished` from lifecycle status. */
export function isPublishedFromStatus(status: StorefrontLocaleStatus): boolean {
  return status === "PUBLISHED";
}

/**
 * Effective lifecycle including soft-deleted rows that retain 301 targets.
 * `deletedAt` wins over `status` so export/delete can clear translation data
 * while keeping the registry row for redirects (ADR-0007).
 */
export function localeLifecycleState(locale: {
  status: StorefrontLocaleStatus;
  deletedAt?: Date | null;
}): LocaleLifecycleState {
  if (locale.deletedAt) return "deleted";
  switch (locale.status) {
    case "PUBLISHED":
      return "published";
    case "RETIRED":
      return "retired";
    default:
      return "draft";
  }
}

export function retentionDaysElapsed(
  retiredAt: Date | null | undefined,
  now: Date = new Date(),
  retentionDays: number = LOCALE_DELETE_RETENTION_DAYS,
): boolean {
  if (!retiredAt) return false;
  const elapsedMs = now.getTime() - retiredAt.getTime();
  return elapsedMs >= retentionDays * 24 * 60 * 60 * 1000;
}
