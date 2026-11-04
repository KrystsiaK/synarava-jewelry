import type { ServiceStatusLevel } from "@/lib/mission-control/status";

/** Admin-facing severity; maps to ServiceStatusLevel warn/down. */
export type AnalyticsIssueSeverity = "warning" | "error";

export type AnalyticsIssueKind =
  | "funnel_dropoff"
  | "telemetry_breakage"
  | "silent_event"
  | "clarity_friction"
  | "source_unavailable";

export type AnalyticsIssue = {
  id: string;
  kind: AnalyticsIssueKind;
  severity: AnalyticsIssueSeverity;
  /** Plain-language what happened. */
  title: string;
  /** When the condition started or the observation window began (ISO). */
  since: string;
  /** Key numbers for the issue (no PII). */
  numbers: Record<string, number | string>;
  /** Where to look (admin path or external console label). */
  whereToLook: string;
  /** How to fix — short admin hint. */
  fixHint: string;
  source: "ga" | "clarity" | "config";
  period: string;
};

/** Informational only — does not affect ServiceStatusLevel. */
export type AnalyticsNotice = {
  id: string;
  tone: "info";
  title: string;
  detail: string;
};

export type AnalyticsConnectionState = "connected" | "not_connected";

export type AnalyticsSnapshotPayload = {
  connection: AnalyticsConnectionState;
  level: ServiceStatusLevel;
  message: string;
  issues: AnalyticsIssue[];
  /** Config gaps / caveats that are not warn/error/ok. */
  notices: AnalyticsNotice[];
  checkedAt: string;
  /** ISO of last successful Clarity fetch reused in this snapshot (if any). */
  clarityDataAsOf: string | null;
  /** GA figures = consented visitors only. */
  gaConsentNote: string;
  /** Clarity includes bots; subtract totalBotSessionCount when comparing. */
  clarityBotNote: string;
  limits: {
    clarityCallsUsedToday: number;
    clarityBudgetPerDay: number;
    clarityHardLimitPerDay: number;
    gaLookbackDays: number;
    clarityNumOfDays: number;
  };
  sources: {
    ga: "connected" | "not_connected" | "skipped";
    clarity: "connected" | "not_connected" | "skipped" | "budget_held";
  };
  figures: Array<{
    label: string;
    value: number | string;
    period: string;
    source: "ga" | "clarity";
  }>;
};

export const ANALYTICS_NODE_KEY = "analytics";
export const ANALYTICS_NOT_CONNECTED_MESSAGE = "not connected";

export const GA_CONSENT_NOTE =
  "GA counts only visitors who gave analytics consent (consented share).";

export const CLARITY_BOT_NOTE =
  "Clarity includes bots (totalBotSessionCount) — subtract or label bot sessions when reading traffic.";

export function severityToLevel(
  severity: AnalyticsIssueSeverity,
): Exclude<ServiceStatusLevel, "ok" | "unknown"> {
  return severity === "error" ? "down" : "warn";
}

export function worstLevelFromIssues(
  issues: readonly AnalyticsIssue[],
): ServiceStatusLevel {
  if (issues.some((issue) => issue.severity === "error")) return "down";
  if (issues.some((issue) => issue.severity === "warning")) return "warn";
  return "ok";
}
