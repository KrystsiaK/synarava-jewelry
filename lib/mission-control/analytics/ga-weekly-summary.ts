/**
 * Pure GA4 weekly email-style summary parse + deep link.
 * No fetch/JWT — safe for unit tests. Collector uses ga-client for API calls.
 *
 * Two runReports:
 * 1) Overview totals (users, sessions, purchases, revenue) — current 7d vs prior 7d
 * 2) Top pages (pagePath) for current 7d
 * Overview report also carries top traffic sources (sessionSource) for current 7d.
 *
 * @see https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/properties/runReport
 */

import {
  formatWeekDelta,
  GA_RESERVED_TOTAL,
} from "@/lib/mission-control/analytics/ga-visit-pulse";

export type GaWeeklyPeriodMetrics = {
  users: number;
  sessions: number;
  purchases: number;
  revenue: number;
  /** purchases / sessions (0 when sessions = 0). */
  conversionRate: number;
};

export type GaWeeklyShareRow = {
  name: string;
  sessions: number;
  sharePct: number;
};

export type GaWeeklySummary = {
  current: GaWeeklyPeriodMetrics;
  previous: GaWeeklyPeriodMetrics;
  /** Top 5 sessionSource rows for the current 7d window. */
  sources: GaWeeklyShareRow[];
  /** Top 5 pagePath rows for the current 7d window. */
  pages: GaWeeklyShareRow[];
};

export type GaWeeklyReportJson = {
  dimensionHeaders?: Array<{ name?: string }>;
  metricHeaders?: Array<{ name?: string }>;
  rows?: Array<{
    dimensionValues?: Array<{ value?: string }>;
    metricValues?: Array<{ value?: string }>;
  }>;
  totals?: Array<{
    dimensionValues?: Array<{ value?: string }>;
    metricValues?: Array<{ value?: string }>;
  }>;
};

const EMPTY_PERIOD: GaWeeklyPeriodMetrics = {
  users: 0,
  sessions: 0,
  purchases: 0,
  revenue: 0,
  conversionRate: 0,
};

const TOP_N = 5;

function num(value: string | undefined): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function headerIndex(
  headers: Array<{ name?: string }> | undefined,
  name: string,
): number {
  return (headers ?? []).findIndex((h) => h.name === name);
}

function conversionRate(purchases: number, sessions: number): number {
  if (sessions <= 0) return 0;
  return purchases / sessions;
}

function periodFromMetrics(
  values: Array<{ value?: string }> | undefined,
  metricIndex: Record<string, number>,
): GaWeeklyPeriodMetrics {
  const users = num(values?.[metricIndex.activeUsers]?.value);
  const sessions = num(values?.[metricIndex.sessions]?.value);
  const purchases = num(values?.[metricIndex.ecommercePurchases]?.value);
  const revenue = num(values?.[metricIndex.purchaseRevenue]?.value);
  return {
    users,
    sessions,
    purchases,
    revenue,
    conversionRate: conversionRate(purchases, sessions),
  };
}

/** Exact date_range_N only — never Boolean(key) (0 is falsy). */
function dateRangeKey(value: string | undefined): 0 | 1 | null {
  if (value === "date_range_0") return 0;
  if (value === "date_range_1") return 1;
  return null;
}

function topShareRows(
  byName: Map<string, number>,
  totalSessions: number,
): GaWeeklyShareRow[] {
  const denom = totalSessions > 0 ? totalSessions : 1;
  return [...byName.entries()]
    .filter(
      ([name]) =>
        name &&
        name !== "(not set)" &&
        name !== GA_RESERVED_TOTAL &&
        name !== "(other)",
    )
    .toSorted((a, b) => b[1] - a[1])
    .slice(0, TOP_N)
    .map(([name, sessions]) => ({
      name,
      sessions,
      sharePct: Math.round((sessions / denom) * 100),
    }));
}

/**
 * Parse overview runReport: dimension sessionSource, two date ranges,
 * metrics activeUsers / sessions / ecommercePurchases / purchaseRevenue,
 * metricAggregations TOTAL.
 */
export function parseGaWeeklyOverviewReport(
  report: GaWeeklyReportJson,
): Pick<GaWeeklySummary, "current" | "previous" | "sources"> {
  const dimHeaders = report.dimensionHeaders;
  const metricHeaders = report.metricHeaders;
  const sourceIdx = headerIndex(dimHeaders, "sessionSource");
  const rangeIdx = headerIndex(dimHeaders, "dateRange");
  const metricIndex = {
    activeUsers: headerIndex(metricHeaders, "activeUsers"),
    sessions: headerIndex(metricHeaders, "sessions"),
    ecommercePurchases: headerIndex(metricHeaders, "ecommercePurchases"),
    purchaseRevenue: headerIndex(metricHeaders, "purchaseRevenue"),
  };

  let current = { ...EMPTY_PERIOD };
  let previous = { ...EMPTY_PERIOD };

  for (const total of report.totals ?? []) {
    const dims = total.dimensionValues ?? [];
    const key =
      rangeIdx >= 0 ? dateRangeKey(dims[rangeIdx]?.value) : null;
    if (key === null) continue;
    const period = periodFromMetrics(total.metricValues, metricIndex);
    if (key === 0) current = period;
    else previous = period;
  }

  const currentBySource = new Map<string, number>();
  for (const row of report.rows ?? []) {
    const dims = row.dimensionValues ?? [];
    const metrics = row.metricValues ?? [];
    if (sourceIdx < 0) continue;
    const key =
      rangeIdx >= 0 ? dateRangeKey(dims[rangeIdx]?.value) : 0;
    if (key !== 0) continue;
    const name = dims[sourceIdx]?.value ?? "";
    if (!name || name === GA_RESERVED_TOTAL) continue;
    const sessions =
      metricIndex.sessions >= 0
        ? num(metrics[metricIndex.sessions]?.value)
        : num(metrics[1]?.value);
    currentBySource.set(
      name,
      (currentBySource.get(name) ?? 0) + sessions,
    );
  }

  // Fallback when totals absent: sum current-range source rows.
  if ((report.totals ?? []).length === 0 || rangeIdx < 0) {
    const sessions = [...currentBySource.values()].reduce(
      (a, b) => a + b,
      0,
    );
    current = {
      ...EMPTY_PERIOD,
      sessions,
      conversionRate: 0,
    };
  }

  return {
    current,
    previous,
    sources: topShareRows(currentBySource, current.sessions),
  };
}

/**
 * Parse pages runReport: dimension pagePath, current 7d only (or multi-range
 * — only date_range_0 / missing range is kept).
 */
export function parseGaWeeklyPagesReport(
  report: GaWeeklyReportJson,
  totalSessions: number,
): GaWeeklyShareRow[] {
  const dimHeaders = report.dimensionHeaders;
  const metricHeaders = report.metricHeaders;
  const pathIdx = headerIndex(dimHeaders, "pagePath");
  const rangeIdx = headerIndex(dimHeaders, "dateRange");
  const sessionsIdx = headerIndex(metricHeaders, "sessions");

  const byPath = new Map<string, number>();
  for (const row of report.rows ?? []) {
    const dims = row.dimensionValues ?? [];
    const metrics = row.metricValues ?? [];
    if (pathIdx < 0) continue;
    if (rangeIdx >= 0) {
      const key = dateRangeKey(dims[rangeIdx]?.value);
      if (key !== null && key !== 0) continue;
    }
    const path = dims[pathIdx]?.value ?? "";
    if (!path || path === GA_RESERVED_TOTAL) continue;
    const sessions =
      sessionsIdx >= 0
        ? num(metrics[sessionsIdx]?.value)
        : num(metrics[0]?.value);
    byPath.set(path, (byPath.get(path) ?? 0) + sessions);
  }

  return topShareRows(byPath, totalSessions);
}

export function parseGaWeeklySummary(input: {
  overview: GaWeeklyReportJson;
  pages: GaWeeklyReportJson;
}): GaWeeklySummary {
  const overview = parseGaWeeklyOverviewReport(input.overview);
  return {
    current: overview.current,
    previous: overview.previous,
    sources: overview.sources,
    pages: parseGaWeeklyPagesReport(input.pages, overview.current.sessions),
  };
}

export function formatConversionPct(rate: number): string {
  return `${(rate * 100).toFixed(rate >= 0.1 ? 1 : 2)}%`;
}

export function formatRevenue(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export { buildGaIntelligentHomeUrl } from "@/lib/mission-control/analytics/ga-visit-pulse";

export function formatWeeklySummaryMessage(summary: GaWeeklySummary): string {
  const delta = formatWeekDelta(
    summary.current.sessions,
    summary.previous.sessions,
  );
  return (
    `GA 7д: ${summary.current.users} users · ${summary.current.sessions} sessions (${delta})` +
    ` · ${summary.current.purchases} orders · revenue ${formatRevenue(summary.current.revenue)}` +
    ` · conv ${formatConversionPct(summary.current.conversionRate)}`
  );
}
