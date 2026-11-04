import type { ClarityFrictionRow } from "@/lib/mission-control/analytics/detect";

export type ClarityPrimaryCountResult =
  | { recognized: true; count: number }
  | { recognized: false; count: null };

/** Explicit count field names Clarity export rows may use (case-insensitive). */
const COUNT_FIELD_NAMES = [
  "sessionscount",
  "sessioncount",
  "totalsessioncount",
  "count",
  "deadclickcount",
  "rageclickcount",
  "quickbackclickcount",
  "quickbackclick",
  "excessivescrollcount",
  "excessivescroll",
  "scripterrorcount",
  "errorclickcount",
  "value",
] as const;

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function normalizeKey(key: string): string {
  return key.replace(/[\s_/]+/g, "").toLowerCase();
}

/**
 * Pick a friction/session count by known field names, then a numeric fallback
 * that is not a dimension label. Unrecognized → recognized:false (not silent 0).
 */
export function pickClarityPrimaryCount(
  info: Record<string, unknown>,
): ClarityPrimaryCountResult {
  const byNorm = new Map<string, unknown>();
  for (const [key, value] of Object.entries(info)) {
    byNorm.set(normalizeKey(key), value);
  }

  for (const name of COUNT_FIELD_NAMES) {
    if (!byNorm.has(name)) continue;
    const n = num(byNorm.get(name));
    if (n !== null) return { recognized: true, count: n };
  }

  const skip = new Set([
    "url",
    "device",
    "browser",
    "os",
    "countryregion",
    "country/region",
    "source",
    "medium",
    "campaign",
    "channel",
    "pagetitle",
    "referrerurl",
  ]);

  for (const [key, value] of Object.entries(info)) {
    const norm = normalizeKey(key);
    if (skip.has(norm)) continue;
    if (typeof value === "string" && !/^-?\d+(\.\d+)?$/.test(value.trim())) {
      continue;
    }
    const n = num(value);
    if (n !== null) return { recognized: true, count: n };
  }

  return { recognized: false, count: null };
}

type ClarityMetricBlock = {
  metricName?: string;
  information?: Array<Record<string, unknown>>;
};

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export type ParsedClarityExport = {
  rows: ClarityFrictionRow[];
  totalBotSessionCount: number;
  totalSessionCount: number;
  /** True when at least one friction metric row had no recognized count field. */
  formatUnrecognized: boolean;
};

/**
 * Parse Clarity project-live-insights JSON into friction rows.
 * Unrecognized count shapes set formatUnrecognized (caller emits warning).
 */
export function parseClarityExportBody(
  body: unknown,
): ParsedClarityExport {
  if (!Array.isArray(body)) {
    return {
      rows: [],
      totalBotSessionCount: 0,
      totalSessionCount: 0,
      formatUnrecognized: true,
    };
  }

  const blocks = body as ClarityMetricBlock[];
  const byKey = new Map<string, ClarityFrictionRow>();
  let totalBotSessionCount = 0;
  let totalSessionCount = 0;
  let formatUnrecognized = false;
  let sawFrictionMetric = false;

  const ensure = (pageUrl: string, device: string): ClarityFrictionRow => {
    const key = `${pageUrl}\0${device}`;
    const existing = byKey.get(key);
    if (existing) return existing;
    const created: ClarityFrictionRow = {
      url: pageUrl,
      device,
      deadClickCount: 0,
      rageClickCount: 0,
      quickbackClickCount: 0,
      excessiveScrollCount: 0,
      scriptErrorCount: 0,
      errorClickCount: 0,
    };
    byKey.set(key, created);
    return created;
  };

  for (const block of blocks) {
    const metric = (block.metricName ?? "").trim().toLowerCase();
    for (const info of block.information ?? []) {
      if (metric === "traffic") {
        totalBotSessionCount += num(info.totalBotSessionCount) ?? 0;
        totalSessionCount += num(info.totalSessionCount) ?? 0;
        continue;
      }

      const isFriction =
        metric === "dead click count" ||
        metric === "rage click count" ||
        metric === "quickback click" ||
        metric === "excessive scroll" ||
        metric === "script error count" ||
        metric === "error click count";

      if (!isFriction) continue;
      sawFrictionMetric = true;

      const picked = pickClarityPrimaryCount(info);
      if (!picked.recognized) {
        formatUnrecognized = true;
        continue;
      }

      const pageUrl = str(info.URL ?? info.Url ?? info.url) || "(unknown)";
      const device = str(info.Device ?? info.device) || "(unknown)";
      const row = ensure(pageUrl, device);
      const count = picked.count;

      if (metric === "dead click count") row.deadClickCount += count;
      else if (metric === "rage click count") row.rageClickCount += count;
      else if (metric === "quickback click") row.quickbackClickCount += count;
      else if (metric === "excessive scroll") row.excessiveScrollCount += count;
      else if (metric === "script error count") row.scriptErrorCount += count;
      else if (metric === "error click count") row.errorClickCount += count;
    }
  }

  if (sawFrictionMetric && byKey.size === 0 && formatUnrecognized) {
    // keep flag
  }

  return {
    rows: [...byKey.values()],
    totalBotSessionCount,
    totalSessionCount,
    formatUnrecognized,
  };
}

export function clarityFormatUnrecognizedIssue(since: string): {
  id: string;
  kind: "source_unavailable";
  severity: "warning";
  title: string;
  since: string;
  numbers: Record<string, never>;
  whereToLook: string;
  fixHint: string;
  source: "clarity";
  period: string;
} {
  return {
    id: "clarity:format_unrecognized",
    kind: "source_unavailable",
    severity: "warning",
    title: "Clarity response format unrecognized",
    since,
    numbers: {},
    whereToLook: "Clarity → Settings → Data Export / API response shape",
    fixHint:
      "Export rows lacked known count fields (sessionsCount/count/…). Check API version and dimension payload — do not treat as zero friction.",
    source: "clarity",
    period: "this collector run",
  };
}
