import type { AnalyticsSnapshotPayload } from "@/lib/mission-control/analytics/types";

/**
 * Client-safe readers for stored Analytics counters.
 * Keep free of node:crypto / GA / Clarity clients so hub UI can import this.
 */

export function readAnalyticsPayloadFromCounters(
  counters: unknown,
): AnalyticsSnapshotPayload | null {
  if (!counters || typeof counters !== "object" || Array.isArray(counters)) {
    return null;
  }
  const analytics = (counters as Record<string, unknown>).analytics;
  if (!analytics || typeof analytics !== "object" || Array.isArray(analytics)) {
    return null;
  }
  return analytics as AnalyticsSnapshotPayload;
}

export function readAnalyticsReportMarkdown(counters: unknown): string | null {
  if (!counters || typeof counters !== "object" || Array.isArray(counters)) {
    return null;
  }
  const value = (counters as Record<string, unknown>).reportMarkdown;
  return typeof value === "string" ? value : null;
}
