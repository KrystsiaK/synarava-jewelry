/**
 * Pure GA4 visit-pulse parse + card copy.
 * No fetch/JWT — safe for unit tests. Collector uses ga-client for the API call.
 *
 * Multi-range TOTAL shape (Analytics Data API): totals rows carry the same
 * dimension columns as data rows — countryId = RESERVED_TOTAL, dateRange =
 * date_range_N. Read dateRange only via the header named "dateRange".
 * @see https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/properties/runReport
 */

export type GaVisitPeriodMetrics = {
  sessions: number;
  activeUsers: number;
  averageSessionDurationSec: number;
  engagementRate: number | null;
};

export type GaVisitCountryShare = {
  countryId: string;
  sessions: number;
  sharePct: number;
};

export type GaVisitPulse = {
  current: GaVisitPeriodMetrics;
  previous: GaVisitPeriodMetrics;
  lastDaySessions: number;
  /** Top 5 countries for the current 7d window (real countryId only). */
  countries: GaVisitCountryShare[];
  /** Sessions outside top 5 (UI label «остальные»). */
  otherSessions: number;
  otherSharePct: number;
  /** Prior-week top-3 country ids (for new-country detection). */
  previousTopCountryIds: string[];
};

export type GaVisitPulseReportJson = {
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

const EMPTY_PERIOD: GaVisitPeriodMetrics = {
  sessions: 0,
  activeUsers: 0,
  averageSessionDurationSec: 0,
  engagementRate: null,
};

const TOP_COUNTRIES = 5;
const TOP_COMPARE = 3;
/** GA4 TOTAL placeholder in dimension columns (not a real country). */
export const GA_RESERVED_TOTAL = "RESERVED_TOTAL";

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

function periodFromMetrics(
  values: Array<{ value?: string }> | undefined,
  metricIndex: Record<string, number>,
): GaVisitPeriodMetrics {
  const sessions = num(values?.[metricIndex.sessions]?.value);
  const activeUsers = num(values?.[metricIndex.activeUsers]?.value);
  const averageSessionDurationSec = num(
    values?.[metricIndex.averageSessionDuration]?.value,
  );
  const engRaw = values?.[metricIndex.engagementRate]?.value;
  const engagementRate =
    engRaw === undefined || engRaw === ""
      ? null
      : num(engRaw);
  return {
    sessions,
    activeUsers,
    averageSessionDurationSec,
    engagementRate,
  };
}

/** Exact date_range_N only — no endsWith guessing (Boolean(0) traps). */
function dateRangeKey(value: string | undefined): 0 | 1 | 2 | null {
  if (value === "date_range_0") return 0;
  if (value === "date_range_1") return 1;
  if (value === "date_range_2") return 2;
  return null;
}

function topCountries(
  byCountry: Map<string, number>,
  totalSessions: number,
): {
  countries: GaVisitCountryShare[];
  otherSessions: number;
  otherSharePct: number;
} {
  const sorted = [...byCountry.entries()]
    .filter(([id]) => id && id !== "(not set)" && id !== GA_RESERVED_TOTAL)
    .toSorted((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, TOP_COUNTRIES);
  const otherSessions = sorted
    .slice(TOP_COUNTRIES)
    .reduce((sum, [, sessions]) => sum + sessions, 0);
  const denom = totalSessions > 0 ? totalSessions : 1;
  const countries: GaVisitCountryShare[] = top.map(([countryId, sessions]) => ({
    countryId,
    sessions,
    sharePct: Math.round((sessions / denom) * 100),
  }));
  return {
    countries,
    otherSessions,
    otherSharePct: Math.round((otherSessions / denom) * 100),
  };
}

/**
 * Parse one runReport with date ranges:
 * 0 = current 7d, 1 = previous 7d, 2 = last day.
 * Dimension: countryId (+ automatic dateRange when multi-range).
 */
export function parseGaVisitPulseReport(
  report: GaVisitPulseReportJson,
): GaVisitPulse {
  const dimHeaders = report.dimensionHeaders;
  const metricHeaders = report.metricHeaders;
  const countryIdx = headerIndex(dimHeaders, "countryId");
  const rangeIdx = headerIndex(dimHeaders, "dateRange");
  const metricIndex = {
    sessions: headerIndex(metricHeaders, "sessions"),
    activeUsers: headerIndex(metricHeaders, "activeUsers"),
    averageSessionDuration: headerIndex(
      metricHeaders,
      "averageSessionDuration",
    ),
    engagementRate: headerIndex(metricHeaders, "engagementRate"),
  };

  let current = { ...EMPTY_PERIOD };
  let previous = { ...EMPTY_PERIOD };
  let lastDaySessions = 0;

  const totals = report.totals ?? [];
  if (totals.length > 0 && metricIndex.sessions >= 0 && rangeIdx >= 0) {
    for (const total of totals) {
      const dims = total.dimensionValues ?? [];
      // Same column layout as rows: read dateRange by header index only.
      // Never Boolean(dateRangeKey(...)) — key 0 is falsy.
      const key = dateRangeKey(dims[rangeIdx]?.value);
      if (key === null) continue;
      const period = periodFromMetrics(total.metricValues, metricIndex);
      if (key === 0) current = period;
      else if (key === 1) previous = period;
      else lastDaySessions = period.sessions;
    }
  }

  const currentByCountry = new Map<string, number>();
  const previousByCountry = new Map<string, number>();
  let rowLastDay = 0;

  for (const row of report.rows ?? []) {
    const dims = row.dimensionValues ?? [];
    const metrics = row.metricValues ?? [];
    if (countryIdx < 0 || rangeIdx < 0) continue;
    const country = dims[countryIdx]?.value ?? "";
    const key = dateRangeKey(dims[rangeIdx]?.value);
    if (key === null) continue;
    const sessions =
      metricIndex.sessions >= 0
        ? num(metrics[metricIndex.sessions]?.value)
        : num(metrics[0]?.value);
    if (!country || country === GA_RESERVED_TOTAL) continue;
    if (key === 0) {
      currentByCountry.set(
        country,
        (currentByCountry.get(country) ?? 0) + sessions,
      );
    } else if (key === 1) {
      previousByCountry.set(
        country,
        (previousByCountry.get(country) ?? 0) + sessions,
      );
    } else {
      rowLastDay += sessions;
    }
  }

  if (totals.length === 0 || rangeIdx < 0) {
    const sumMap = (map: Map<string, number>) =>
      [...map.values()].reduce((a, b) => a + b, 0);
    current = {
      ...EMPTY_PERIOD,
      sessions: sumMap(currentByCountry),
      activeUsers: 0,
    };
    previous = {
      ...EMPTY_PERIOD,
      sessions: sumMap(previousByCountry),
      activeUsers: 0,
    };
    lastDaySessions = rowLastDay;
  } else if (lastDaySessions === 0 && rowLastDay > 0) {
    lastDaySessions = rowLastDay;
  }

  const previousTopCountryIds = [...previousByCountry.entries()]
    .filter(([id]) => id && id !== "(not set)" && id !== GA_RESERVED_TOTAL)
    .toSorted((a, b) => b[1] - a[1])
    .slice(0, TOP_COMPARE)
    .map(([id]) => id);

  const ranked = topCountries(currentByCountry, current.sessions);

  return {
    current,
    previous,
    lastDaySessions,
    countries: ranked.countries,
    otherSessions: ranked.otherSessions,
    otherSharePct: ranked.otherSharePct,
    previousTopCountryIds,
  };
}

export function formatDurationRu(totalSec: number): string {
  const sec = Math.max(0, Math.round(totalSec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}м ${s}с`;
}

export function formatWeekDelta(current: number, previous: number): string {
  if (previous <= 0) {
    return current > 0 ? "▲ new" : "—";
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct > 0) return `▲ ${pct}%`;
  if (pct < 0) return `▼ ${Math.abs(pct)}%`;
  return "0%";
}

/** Card copy for the Analytics live node. */
export function formatVisitPulseMessage(pulse: GaVisitPulse): string {
  const delta = formatWeekDelta(
    pulse.current.sessions,
    pulse.previous.sessions,
  );
  const topParts = pulse.countries
    .slice(0, 5)
    .map((c) => `${c.countryId} ${c.sharePct}%`);
  if (pulse.otherSessions > 0) {
    topParts.push(`остальные ${pulse.otherSharePct}%`);
  }
  const countriesPart = topParts.length
    ? ` · Топ стран: ${topParts.join(", ")}`
    : "";
  return (
    `Визиты 7д: ${pulse.current.sessions} (${delta} к прошлой неделе)` +
    ` · Посетители: ${pulse.current.activeUsers}` +
    ` · Среднее время: ${formatDurationRu(pulse.current.averageSessionDurationSec)}` +
    countriesPart
  );
}

/** Direct GA4 Acquisition overview for the property (read-only outbound). */
export function buildGaAcquisitionReportsUrl(propertyId: string): string {
  const id = propertyId.replace(/^properties\//, "").trim();
  return `https://analytics.google.com/analytics/web/#/p${id}/reports/explorer?r=user-acquisition-overview`;
}
