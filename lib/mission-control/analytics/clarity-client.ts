import { ANALYTICS_THRESHOLDS } from "@/lib/mission-control/analytics/thresholds";
import type { ClarityFrictionRow } from "@/lib/mission-control/analytics/detect";

const CLARITY_URL =
  "https://www.clarity.ms/export-data/api/v1/project-live-insights";

export type ClarityClientDeps = {
  token: string;
  fetchFn?: typeof fetch;
  numOfDays?: 1 | 2 | 3;
};

type ClarityMetricBlock = {
  metricName?: string;
  information?: Array<Record<string, unknown>>;
};

function num(value: unknown): number {
  const n =
    typeof value === "string" || typeof value === "number"
      ? Number(value)
      : NaN;
  return Number.isFinite(n) ? n : 0;
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Pick the first numeric field that is not a known dimension. */
function primaryCount(info: Record<string, unknown>): number {
  const skip = new Set([
    "url",
    "device",
    "browser",
    "os",
    "country/region",
    "source",
    "medium",
    "campaign",
    "channel",
    "pagetitle",
    "referrerurl",
  ]);
  for (const [key, value] of Object.entries(info)) {
    if (skip.has(key.toLowerCase())) continue;
    const n = num(value);
    if (n > 0 || value === 0 || value === "0") return n;
  }
  return 0;
}

/**
 * One Clarity call with URL + Device dimensions.
 * Counts toward the ≤4/day hub budget (hard limit 10/project/day).
 * @see https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-data-export-api
 */
export async function fetchClarityFrictionRows(
  deps: ClarityClientDeps,
): Promise<{
  rows: ClarityFrictionRow[];
  totalBotSessionCount: number;
  totalSessionCount: number;
}> {
  const fetchFn = deps.fetchFn ?? fetch;
  const numOfDays = deps.numOfDays ?? ANALYTICS_THRESHOLDS.clarityNumOfDays;
  const url = new URL(CLARITY_URL);
  url.searchParams.set("numOfDays", String(numOfDays));
  url.searchParams.set("dimension1", "URL");
  url.searchParams.set("dimension2", "Device");

  const response = await fetchFn(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${deps.token}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(20_000),
  });

  if (response.status === 429) {
    throw new Error("Clarity API daily limit exceeded (429)");
  }
  if (!response.ok) {
    throw new Error(`Clarity export failed (${response.status})`);
  }

  const body = (await response.json()) as ClarityMetricBlock[];
  if (!Array.isArray(body)) {
    throw new Error("Clarity export shape unexpected");
  }

  const byKey = new Map<string, ClarityFrictionRow>();
  let totalBotSessionCount = 0;
  let totalSessionCount = 0;

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

  for (const block of body) {
    const metric = (block.metricName ?? "").trim().toLowerCase();
    for (const info of block.information ?? []) {
      if (metric === "traffic") {
        totalBotSessionCount += num(info.totalBotSessionCount);
        totalSessionCount += num(info.totalSessionCount);
        continue;
      }

      const pageUrl = str(info.URL ?? info.Url ?? info.url) || "(unknown)";
      const device = str(info.Device ?? info.device) || "(unknown)";
      const row = ensure(pageUrl, device);
      const count = primaryCount(info);

      if (metric === "dead click count") row.deadClickCount += count;
      else if (metric === "rage click count") row.rageClickCount += count;
      else if (metric === "quickback click") row.quickbackClickCount += count;
      else if (metric === "excessive scroll") row.excessiveScrollCount += count;
      else if (metric === "script error count") row.scriptErrorCount += count;
      else if (metric === "error click count") row.errorClickCount += count;
    }
  }

  return {
    rows: [...byKey.values()],
    totalBotSessionCount,
    totalSessionCount,
  };
}
