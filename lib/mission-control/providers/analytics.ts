import "server-only";

import {
  canCallClarity,
  readClarityBudgetFromCounters,
  readClarityLastSuccessFromCounters,
  recordClarityCall,
  recordClaritySuccess,
  type ClarityLastSuccessCache,
} from "@/lib/mission-control/analytics/clarity-budget";
import { fetchClarityFrictionRows } from "@/lib/mission-control/analytics/clarity-client";
import { clarityFormatUnrecognizedIssue } from "@/lib/mission-control/analytics/clarity-parse";
import { detectAnalyticsIssues } from "@/lib/mission-control/analytics/detect";
import {
  fetchGaEventCounts,
  fetchGaTelemetryCounts,
} from "@/lib/mission-control/analytics/ga-client";
import { parseGaServiceAccountJson } from "@/lib/mission-control/analytics/ga-jwt";
import { safeHttpFailureReason } from "@/lib/mission-control/analytics/http-reason";
import { formatAnalyticsMarkdownReport } from "@/lib/mission-control/analytics/report";
import { buildTelemetryNotConfiguredNotice } from "@/lib/mission-control/analytics/telemetry-notice";
import { ANALYTICS_THRESHOLDS } from "@/lib/mission-control/analytics/thresholds";
import {
  ANALYTICS_NODE_KEY,
  ANALYTICS_NOT_CONNECTED_MESSAGE,
  CLARITY_BOT_NOTE,
  GA_CONSENT_NOTE,
  worstLevelFromIssues,
  type AnalyticsIssue,
  type AnalyticsNotice,
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
    Pick<
      AnalyticsSnapshotPayload,
      "connection" | "level" | "message" | "sources"
    >,
): AnalyticsSnapshotPayload {
  return {
    issues: [],
    notices: [],
    clarityDataAsOf: null,
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
  lastSuccessAt: string | null,
  lastSuccess: ClarityLastSuccessCache | null,
): ServiceNodeStatusRecord {
  const counters = {
    analytics: payload,
    reportMarkdown: formatAnalyticsMarkdownReport(payload),
    clarityBudgetDay: budgetDay,
    clarityCallsUsedToday: payload.limits.clarityCallsUsedToday,
    clarityLastSuccessAt: lastSuccessAt,
    ...(lastSuccess ? { clarityLastSuccess: lastSuccess } : {}),
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

function sourceUnavailableIssue(
  id: string,
  source: "ga" | "clarity",
  title: string,
  reason: string,
  now: Date,
  whereToLook: string,
  fixHint: string,
): AnalyticsIssue {
  return {
    id,
    kind: "source_unavailable",
    severity: "warning",
    title,
    since: now.toISOString().slice(0, 10),
    numbers: { reason },
    whereToLook,
    fixHint,
    source,
    period: "this collector run",
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
  let lastSuccess = readClarityLastSuccessFromCounters(previousCounters);

  if (!gaOk && !clarityOk) {
    const payload = basePayload(now, {
      connection: "not_connected",
      level: "unknown",
      message: ANALYTICS_NOT_CONNECTED_MESSAGE,
      sources: { ga: "not_connected", clarity: "not_connected" },
      clarityDataAsOf: lastSuccess?.fetchedAt ?? null,
      limits: {
        clarityCallsUsedToday: budget.callsUsed,
        clarityBudgetPerDay: ANALYTICS_THRESHOLDS.clarityApiBudgetPerDay,
        clarityHardLimitPerDay: ANALYTICS_THRESHOLDS.clarityApiHardLimitPerDay,
        gaLookbackDays: ANALYTICS_THRESHOLDS.gaLookbackDays,
        clarityNumOfDays: ANALYTICS_THRESHOLDS.clarityNumOfDays,
      },
    });
    return toRecord(
      payload,
      now,
      budget.day,
      budget.lastSuccessAt,
      lastSuccess,
    );
  }

  const sa = parseGaServiceAccountJson(env.GA_SERVICE_ACCOUNT_JSON ?? undefined);
  let gaEvents = undefined as
    | Awaited<ReturnType<typeof fetchGaEventCounts>>
    | undefined;
  let gaTelemetry = undefined as
    | Awaited<ReturnType<typeof fetchGaTelemetryCounts>>
    | undefined;
  let clarityRows = undefined as
    | Awaited<ReturnType<typeof fetchClarityFrictionRows>>["rows"]
    | undefined;
  let totalBotSessionCount = 0;
  let totalSessionCount = 0;
  let clarityDataAsOf: string | null = null;
  let claritySource: AnalyticsSnapshotPayload["sources"]["clarity"] = clarityOk
    ? "connected"
    : "not_connected";
  let gaSource: AnalyticsSnapshotPayload["sources"]["ga"] = gaOk
    ? "connected"
    : "not_connected";
  let nextBudget = budget;
  const sourceIssues: AnalyticsIssue[] = [];
  const notices: AnalyticsNotice[] = [];

  if (gaOk && sa && env.GA_PROPERTY_ID) {
    const gaDeps = {
      propertyId: env.GA_PROPERTY_ID,
      serviceAccount: sa,
      fetchFn,
      now,
    };

    // Telemetry query needs custom dims + GTM; gated so empty config does not 400.
    const telemetryEnabled = ANALYTICS_THRESHOLDS.gaTelemetryQueryEnabled;
    if (!telemetryEnabled) {
      notices.push(buildTelemetryNotConfiguredNotice());
    }

    const settled = await Promise.allSettled([
      fetchGaEventCounts(gaDeps),
      telemetryEnabled
        ? fetchGaTelemetryCounts(gaDeps)
        : Promise.resolve([] as Awaited<ReturnType<typeof fetchGaTelemetryCounts>>),
    ]);

    const eventsResult = settled[0];
    const telemetryResult = settled[1];

    if (eventsResult.status === "fulfilled") {
      gaEvents = eventsResult.value;
    } else {
      gaSource = "skipped";
      sourceIssues.push(
        sourceUnavailableIssue(
          "source:ga",
          "ga",
          "Google Analytics Data API unavailable this run",
          safeHttpFailureReason(eventsResult.reason),
          now,
          "GA4 property access + Analytics Data API enablement",
          "Confirm GA_PROPERTY_ID, service-account Viewer access, and Analytics Data API is enabled. Do not log the JSON key.",
        ),
      );
    }

    if (telemetryEnabled) {
      if (telemetryResult.status === "fulfilled") {
        gaTelemetry = telemetryResult.value;
      } else if (eventsResult.status === "fulfilled") {
        // Events ok but telemetry failed — keep GA connected, note the gap safely.
        sourceIssues.push(
          sourceUnavailableIssue(
            "source:ga_telemetry",
            "ga",
            "GA synarava_telemetry query unavailable this run",
            safeHttpFailureReason(telemetryResult.reason),
            now,
            "GA4 custom dimensions telemetry_kind / rating + GTM",
            "Enable gaTelemetryQueryEnabled only after custom dims exist; otherwise leave gated.",
          ),
        );
      }
    }
  }

  if (clarityOk && env.CLARITY_API_TOKEN) {
    if (!canCallClarity(nextBudget, now)) {
      claritySource = "budget_held";
      if (lastSuccess) {
        clarityRows = lastSuccess.rows;
        totalBotSessionCount = lastSuccess.totalBotSessionCount;
        totalSessionCount = lastSuccess.totalSessionCount;
        clarityDataAsOf = lastSuccess.fetchedAt;
      }
    } else {
      try {
        const clarity = await fetchClarityFrictionRows({
          token: env.CLARITY_API_TOKEN,
          fetchFn,
        });
        clarityRows = clarity.rows;
        totalBotSessionCount = clarity.totalBotSessionCount;
        totalSessionCount = clarity.totalSessionCount;
        clarityDataAsOf = now.toISOString();
        nextBudget = recordClaritySuccess(
          recordClarityCall(nextBudget, 1),
          now,
        );
        lastSuccess = {
          fetchedAt: clarityDataAsOf,
          rows: clarity.rows,
          totalBotSessionCount,
          totalSessionCount,
        };
        if (clarity.formatUnrecognized) {
          sourceIssues.push(
            clarityFormatUnrecognizedIssue(now.toISOString().slice(0, 10)),
          );
        }
      } catch (error) {
        claritySource = "skipped";
        nextBudget = recordClarityCall(nextBudget, 1);
        sourceIssues.push(
          sourceUnavailableIssue(
            "source:clarity",
            "clarity",
            "Clarity Data Export API unavailable this run",
            safeHttpFailureReason(error),
            now,
            "Clarity → Settings → Data Export",
            "Confirm CLARITY_API_TOKEN is valid and under the 10/day project limit. Hub budget is 4/day with ≥6h between successes.",
          ),
        );
        if (lastSuccess) {
          clarityRows = lastSuccess.rows;
          totalBotSessionCount = lastSuccess.totalBotSessionCount;
          totalSessionCount = lastSuccess.totalSessionCount;
          clarityDataAsOf = lastSuccess.fetchedAt;
        }
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
  if (
    (claritySource === "connected" || claritySource === "budget_held") &&
    clarityDataAsOf
  ) {
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
    notices,
    clarityDataAsOf,
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

  return toRecord(
    payload,
    now,
    nextBudget.day,
    nextBudget.lastSuccessAt,
    lastSuccess,
  );
}
