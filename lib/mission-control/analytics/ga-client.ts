import "server-only";

import { ANALYTICS_THRESHOLDS } from "@/lib/mission-control/analytics/thresholds";
import type {
  GaEventCount,
  GaTelemetryCount,
} from "@/lib/mission-control/analytics/detect";
import {
  fetchGaAccessToken,
  type GaServiceAccount,
} from "@/lib/mission-control/analytics/ga-jwt";

const DATA_API =
  "https://analyticsdata.googleapis.com/v1beta/properties";

type RunReportRow = {
  dimensionValues?: Array<{ value?: string }>;
  metricValues?: Array<{ value?: string }>;
};

type RunReportResponse = {
  rows?: RunReportRow[];
};

export type GaClientDeps = {
  propertyId: string;
  serviceAccount: GaServiceAccount;
  fetchFn?: typeof fetch;
  lookbackDays?: number;
  now?: Date;
};

async function runReport(
  deps: GaClientDeps,
  accessToken: string,
  body: Record<string, unknown>,
): Promise<RunReportResponse> {
  const fetchFn = deps.fetchFn ?? fetch;
  const propertyId = deps.propertyId.replace(/^properties\//, "");
  const response = await fetchFn(
    `${DATA_API}/${propertyId}:runReport`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    },
  );
  if (!response.ok) {
    throw new Error(`GA runReport failed (${response.status})`);
  }
  return (await response.json()) as RunReportResponse;
}

function dateRange(lookbackDays: number) {
  return {
    startDate: `${lookbackDays}daysAgo`,
    endDate: "today",
  };
}

/** Event counts for funnel + silence detection. */
export async function fetchGaEventCounts(
  deps: GaClientDeps,
): Promise<GaEventCount[]> {
  const lookback = deps.lookbackDays ?? ANALYTICS_THRESHOLDS.gaLookbackDays;
  const accessToken = await fetchGaAccessToken(
    deps.serviceAccount,
    deps.fetchFn ?? fetch,
  );
  const names = [...ANALYTICS_THRESHOLDS.expectedEvents];
  const report = await runReport(deps, accessToken, {
    dateRanges: [dateRange(lookback)],
    dimensions: [{ name: "eventName" }, { name: "date" }],
    metrics: [{ name: "eventCount" }],
    dimensionFilter: {
      filter: {
        fieldName: "eventName",
        inListFilter: { values: names },
      },
    },
  });

  const totals = new Map<string, { eventCount: number; lastSeenDate: string | null }>();
  for (const name of names) {
    totals.set(name, { eventCount: 0, lastSeenDate: null });
  }

  for (const row of report.rows ?? []) {
    const eventName = row.dimensionValues?.[0]?.value;
    const date = row.dimensionValues?.[1]?.value;
    const count = Number(row.metricValues?.[0]?.value ?? 0);
    if (!eventName || !Number.isFinite(count)) continue;
    const entry = totals.get(eventName) ?? {
      eventCount: 0,
      lastSeenDate: null as string | null,
    };
    entry.eventCount += count;
    if (count > 0 && date) {
      const iso = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
      if (!entry.lastSeenDate || iso > entry.lastSeenDate) {
        entry.lastSeenDate = iso;
      }
    }
    totals.set(eventName, entry);
  }

  return [...totals.entries()].map(([eventName, value]) => ({
    eventName,
    eventCount: value.eventCount,
    lastSeenDate: value.lastSeenDate,
  }));
}

/**
 * synarava_telemetry counts by telemetry.kind custom dimension.
 * Requires GA4 custom dimension `telemetry_kind` (event-scoped) mapped from
 * the dataLayer telemetry.kind field — see docs/wiki/analytics.
 */
export async function fetchGaTelemetryCounts(
  deps: GaClientDeps,
): Promise<GaTelemetryCount[]> {
  const lookback = deps.lookbackDays ?? ANALYTICS_THRESHOLDS.gaLookbackDays;
  const accessToken = await fetchGaAccessToken(
    deps.serviceAccount,
    deps.fetchFn ?? fetch,
  );

  const report = await runReport(deps, accessToken, {
    dateRanges: [dateRange(lookback)],
    dimensions: [
      { name: "customEvent:telemetry_kind" },
      { name: "customEvent:rating" },
    ],
    metrics: [{ name: "eventCount" }],
    dimensionFilter: {
      filter: {
        fieldName: "eventName",
        stringFilter: { matchType: "EXACT", value: "synarava_telemetry" },
      },
    },
  });

  const byKind = new Map<string, { eventCount: number; poorCount: number }>();

  for (const row of report.rows ?? []) {
    const kind = row.dimensionValues?.[0]?.value ?? "(not set)";
    const rating = (row.dimensionValues?.[1]?.value ?? "").toLowerCase();
    const count = Number(row.metricValues?.[0]?.value ?? 0);
    if (!Number.isFinite(count)) continue;
    const entry = byKind.get(kind) ?? { eventCount: 0, poorCount: 0 };
    entry.eventCount += count;
    if (kind === "web_vital" && rating === "poor") {
      entry.poorCount += count;
    }
    byKind.set(kind, entry);
  }

  return [...byKind.entries()].map(([kind, value]) => ({
    kind,
    eventCount: value.eventCount,
    poorCount: value.poorCount,
  }));
}
