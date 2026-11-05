import { ANALYTICS_THRESHOLDS } from "@/lib/mission-control/analytics/thresholds";
import type { ClarityFrictionRow } from "@/lib/mission-control/analytics/detect";
import { parseClarityExportBody } from "@/lib/mission-control/analytics/clarity-parse";
import { safeHttpFailureReason } from "@/lib/mission-control/analytics/http-reason";

const CLARITY_URL =
  "https://www.clarity.ms/export-data/api/v1/project-live-insights";

export type ClarityClientDeps = {
  token: string;
  fetchFn?: typeof fetch;
  numOfDays?: 1 | 2 | 3;
};

export type ClarityFetchResult = {
  rows: ClarityFrictionRow[];
  totalBotSessionCount: number;
  totalSessionCount: number;
  formatUnrecognized: boolean;
};

/**
 * One Clarity call with URL + Device dimensions.
 * Counts toward the ≤4/day hub budget (hard limit 10/project/day).
 * @see https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-data-export-api
 */
export async function fetchClarityFrictionRows(
  deps: ClarityClientDeps,
): Promise<ClarityFetchResult> {
  const fetchFn = deps.fetchFn ?? fetch;
  const numOfDays = deps.numOfDays ?? ANALYTICS_THRESHOLDS.clarityNumOfDays;
  const url = new URL(CLARITY_URL);
  url.searchParams.set("numOfDays", String(numOfDays));
  url.searchParams.set("dimension1", "URL");
  url.searchParams.set("dimension2", "Device");

  let response: Response;
  try {
    response = await fetchFn(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${deps.token}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    throw new Error(`Clarity export failed (${safeHttpFailureReason(error)})`);
  }

  if (!response.ok) {
    throw new Error(
      `Clarity export failed (${safeHttpFailureReason({ status: response.status })})`,
    );
  }

  const body: unknown = await response.json();
  const parsed = parseClarityExportBody(body);
  return {
    rows: parsed.rows,
    totalBotSessionCount: parsed.totalBotSessionCount,
    totalSessionCount: parsed.totalSessionCount,
    formatUnrecognized: parsed.formatUnrecognized,
  };
}
