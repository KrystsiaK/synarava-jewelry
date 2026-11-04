import {
  canCallClarity,
  readClarityBudgetFromCounters,
  recordClarityCall,
} from "@/lib/mission-control/analytics/clarity-budget";
import { fetchClarityFrictionRows } from "@/lib/mission-control/analytics/clarity-client";
import { detectAnalyticsIssues } from "@/lib/mission-control/analytics/detect";
import {
  fetchGaEventCounts,
  fetchGaTelemetryCounts,
} from "@/lib/mission-control/analytics/ga-client";
import { parseGaServiceAccountJson } from "@/lib/mission-control/analytics/ga-jwt";
import { formatAnalyticsMarkdownReport } from "@/lib/mission-control/analytics/report";
import { ANALYTICS_THRESHOLDS } from "@/lib/mission-control/analytics/thresholds";
import {
  ANALYTICS_NODE_KEY,
  ANALYTICS_NOT_CONNECTED_MESSAGE,
  CLARITY_BOT_NOTE,
  GA_CONSENT_NOTE,
  worstLevelFromIssues,
  type AnalyticsSnapshotPayload,
} from "@/lib/mission-control/analytics/types";
import {
  readServiceNodeStatus,
  type ServiceNodeStatusRecord,
} from "@/lib/mission-control/status";
import type { Prisma } from "@prisma/client";

const HREF = "/admin/mission-control";

export type AnalyticsEnv = {
  CLARITY_API_TOKEN?: string | null;
  GA_PROPERTY_ID?: string | null;
  GA_SERVICE_ACCOUNT_JSON?: string | null;
};

export type AnalyticsDeps = {
  now?: Date;
  env?: AnalyticsEnv;
  fetchFn?: typeof fetch;
  previousCounters?: unknown;
  readPrevious?: typeof readServiceNodeStatus;
};

function envFromProcess(): AnalyticsEnv {
  return {
    CLARITY_API_TOKEN: process.env.CLARITY_API_TOKEN ?? null,
    GA_PROPERTY_ID: process.env.GA_PROPERTY_ID ?? null,
    GA_SERVICE_ACCOUNT_JSON: process.env.GA_SERVICE_ACCOUNT_JSON ?? null,
  };
}

function hasGa(env: AnalyticsEnv): boolean {
  return Boolean(
    env.GA_PROPERTY_ID?.trim() &&
      parseGaServiceAccountJson(env.GA_SERVICE_ACCOUNT_JSON ?? undefined),
  );
}

function hasClarity(env: AnalyticsEnv): boolean {
  return Boolean(env.CLARITY_API_TOKEN?.trim());
}

function basePayload(
  now: Date,
  partial: Partial<AnalyticsSnapshotPayload> &
    Pick<AnalyticsSnapshotPayload, "connection" | "level" | "message" | "sources">,
): AnalyticsSnapshotPayload {
  return {
    issues: [],
    checkedAt: now.toISOString(),
    gaConsentNote: GA_CONSENT_NOTE,
    clarityBotNote: CLARITY_BOT_NOTE,
    limits: {
      clarityCallsUsedToday: 0,
      clarityBudgetPerDay: ANALYTICS_THRESHOLDS.clarityApiBudgetPerDay,
      clarityHardLimitPerDay: ANALYTICS_THRESHOLDS.clarityApiHardLimitPerDay,
      gaLookbackDays: ANALYTICS_THRESHOLDS.gaLookbackDays,
      clarityNumOfDays: ANALYTICS_THRESHOLDS.clarityNumOfDays,
    },
    figures: [],
    ...partial,
  };
}

function toRecord(
  payload: AnalyticsSnapshotPayload,
  now: Date,
  budgetDay: string,
): ServiceNodeStatusRecord {
  const counters = {
    analytics: payload,
    reportMarkdown: formatAnalyticsMarkdownReport(payload),
    clarityBudgetDay: budgetDay,
    clarityCallsUsedToday: payload.limits.clarityCallsUsedToday,
  } satisfies Record<string, unknown>;

  return {
    nodeKey: ANALYTICS_NODE_KEY,
    level: payload.level,
    message: payload.message,
    counters: counters as Prisma.JsonValue,
    href: HREF,
    checkedAt: now,
    updatedAt: now,
  };
}

/**
 * Collector-only Analytics probe (GA Data API + Clarity Export).
 * Hub must read persisted ServiceNodeStatus — never call this from the page.
 */
export async function getAnalyticsStatus(
  deps: AnalyticsDeps = {},
): Promise<ServiceNodeStatusRecord> {
  const now = deps.now ?? new Date();
  const env = deps.env ?? envFromProcess();
  const fetchFn = deps.fetchFn ?? fetch;
  const gaOk = hasGa(env);
  const clarityOk = hasClarity(env);

  let previousCounters = deps.previousCounters;
  if (previousCounters === undefined) {
    const readPrevious = deps.readPrevious ?? readServiceNodeStatus;
    const previous = await readPrevious(ANALYTICS_NODE_KEY);
    previousCounters = previous?.counters ?? null;
  }

  const budget = readClarityBudgetFromCounters(previousCounters, now);

  if (!gaOk && !clarityOk) {
    const payload = basePayload(now, {
      connection: "not_connected",
      level: "unknown",
      message: ANALYTICS_NOT_CONNECTED_MESSAGE,
      sources: { ga: "not_connected", clarity: "not_connected" },
      limits: {
        clarityCallsUsedToday: budget.callsUsed,
        clarityBudgetPerDay: ANALYTICS_THRESHOLDS.clarityApiBudgetPerDay,
        clarityHardLimitPerDay: ANALYTICS_THRESHOLDS.clarityApiHardLimitPerDay,
        gaLookbackDays: ANALYTICS_THRESHOLDS.gaLookbackDays,
        clarityNumOfDays: ANALYTICS_THRESHOLDS.clarityNumOfDays,
      },
    });
    return toRecord(payload, now, budget.day);
  }

  const sa = parseGaServiceAccountJson(env.GA_SERVICE_ACCOUNT_JSON ?? undefined);
  let gaEvents = undefined as Awaited<ReturnType<typeof fetchGaEventCounts>> | undefined;
  let gaTelemetry = undefined as Awaited<ReturnType<typeof fetchGaTelemetryCounts>> | undefined;
  let clarityRows = undefined as Awaited<
    ReturnType<typeof fetchClarityFrictionRows>
  >["rows"] | undefined;
  let totalBotSessionCount = 0;
  let totalSessionCount = 0;
  let claritySource: AnalyticsSnapshotPayload["sources"]["clarity"] = clarityOk
    ? "connected"
    : "not_connected";
  let gaSource: AnalyticsSnapshotPayload["sources"]["ga"] = gaOk
    ? "connected"
    : "not_connected";
  let nextBudget = budget;
  const sourceIssues: AnalyticsSnapshotPayload["issues"] = [];

  if (gaOk && sa && env.GA_PROPERTY_ID) {
    try {
      const gaDeps = {
        propertyId: env.GA_PROPERTY_ID,
        serviceAccount: sa,
        fetchFn,
        now,
      };
      [gaEvents, gaTelemetry] = await Promise.all([
        fetchGaEventCounts(gaDeps),
        fetchGaTelemetryCounts(gaDeps),
      ]);
    } catch {
      gaSource = "skipped";
      sourceIssues.push({
        id: "source:ga",
        kind: "source_unavailable",
        severity: "warning",
        title: "Google Analytics Data API unavailable this run",
        since: now.toISOString().slice(0, 10),
        numbers: {},
        whereToLook: "GA4 property access + Analytics Data API enablement",
        fixHint:
          "Confirm GA_PROPERTY_ID, service-account Viewer access, and Analytics Data API is enabled. Do not log the JSON key.",
        source: "ga",
        period: "this collector run",
      });
    }
  }

  if (clarityOk && env.CLARITY_API_TOKEN) {
    if (!canCallClarity(budget)) {
      claritySource = "budget_held";
    } else {
      try {
        const clarity = await fetchClarityFrictionRows({
          token: env.CLARITY_API_TOKEN,
          fetchFn,
        });
        clarityRows = clarity.rows;
        totalBotSessionCount = clarity.totalBotSessionCount;
        totalSessionCount = clarity.totalSessionCount;
        nextBudget = recordClarityCall(budget, 1);
      } catch {
        claritySource = "skipped";
        nextBudget = recordClarityCall(budget, 1);
        sourceIssues.push({
          id: "source:clarity",
          kind: "source_unavailable",
          severity: "warning",
          title: "Clarity Data Export API unavailable this run",
          since: now.toISOString().slice(0, 10),
          numbers: {},
          whereToLook: "Clarity → Settings → Data Export",
          fixHint:
            "Confirm CLARITY_API_TOKEN is valid and under the 10/day project limit. Hub budget is 4/day.",
          source: "clarity",
          period: "this collector run",
        });
      }
    }
  }

  const detected = detectAnalyticsIssues({
    now,
    gaEvents,
    gaTelemetry,
    clarityRows,
  });
  const issues = [...sourceIssues, ...detected];
  const level = worstLevelFromIssues(issues);
  const message =
    issues.length === 0
      ? "No analytics issues above threshold"
      : `${issues.length} issue(s); worst=${level}`;

  const figures: AnalyticsSnapshotPayload["figures"] = [];
  for (const event of gaEvents ?? []) {
    figures.push({
      label: `GA event ${event.eventName}`,
      value: event.eventCount,
      period: `last ${ANALYTICS_THRESHOLDS.gaLookbackDays} days (consented)`,
      source: "ga",
    });
  }
  for (const row of gaTelemetry ?? []) {
    figures.push({
      label: `GA telemetry ${row.kind}`,
      value: row.eventCount,
      period: `last ${ANALYTICS_THRESHOLDS.gaLookbackDays} days (consented)`,
      source: "ga",
    });
  }
  if (claritySource === "connected") {
    figures.push({
      label: "Clarity sessions (includes bots)",
      value: totalSessionCount,
      period: `last ${ANALYTICS_THRESHOLDS.clarityNumOfDays} days`,
      source: "clarity",
    });
    figures.push({
      label: "Clarity bot sessions",
      value: totalBotSessionCount,
      period: `last ${ANALYTICS_THRESHOLDS.clarityNumOfDays} days`,
      source: "clarity",
    });
  }

  const payload = basePayload(now, {
    connection: "connected",
    level,
    message,
    issues,
    sources: { ga: gaSource, clarity: claritySource },
    limits: {
      clarityCallsUsedToday: nextBudget.callsUsed,
      clarityBudgetPerDay: ANALYTICS_THRESHOLDS.clarityApiBudgetPerDay,
      clarityHardLimitPerDay: ANALYTICS_THRESHOLDS.clarityApiHardLimitPerDay,
      gaLookbackDays: ANALYTICS_THRESHOLDS.gaLookbackDays,
      clarityNumOfDays: ANALYTICS_THRESHOLDS.clarityNumOfDays,
    },
    figures,
  });

  return toRecord(payload, now, nextBudget.day);
}

/** Read stored analytics payload from counters (hub path). */
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
