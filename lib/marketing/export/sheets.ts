import {
  assertGoogleMarketingUrlAllowed,
  fetchGoogleAccessToken,
  GOOGLE_SPREADSHEETS_SCOPE,
  parseGoogleServiceAccountJson,
} from "@/lib/marketing/google/service-account-auth";
import {
  OBSERVATION_CSV_COLUMNS,
  observationToCsvCells,
  type ObservationCsvRow,
} from "@/lib/marketing/export/csv";
import {
  buildBrandSummaries,
  type BrandSummaryRow,
} from "@/lib/marketing/export/summary";

const SHEET_OBS = "Наблюдения";
const SHEET_SUMMARY = "Сводка";

const SUMMARY_COLUMNS = [
  "brand",
  "domain",
  "productsSeen",
  "minPrice",
  "medianPrice",
  "maxPrice",
  "changedLast30",
  "removedLast30",
  "lastFetchedAt",
] as const;

export function isGoogleSheetsExportEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const id = env.GOOGLE_SHEETS_ID?.trim();
  const sa = env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (!id || !sa) return false;
  return parseGoogleServiceAccountJson(sa) != null;
}

function summaryCells(row: BrandSummaryRow): string[] {
  return [
    row.brand,
    row.domain,
    String(row.productsSeen),
    row.minPrice == null ? "" : String(row.minPrice),
    row.medianPrice == null ? "" : String(row.medianPrice),
    row.maxPrice == null ? "" : String(row.maxPrice),
    String(row.changedLast30),
    String(row.removedLast30),
    row.lastFetchedAt ?? "",
  ];
}

export function buildSheetsValues(input: {
  observations: ObservationCsvRow[];
  summaryRows: BrandSummaryRow[];
}): {
  observations: string[][];
  summary: string[][];
} {
  return {
    observations: [
      [...OBSERVATION_CSV_COLUMNS],
      ...input.observations.map(observationToCsvCells),
    ],
    summary: [[...SUMMARY_COLUMNS], ...input.summaryRows.map(summaryCells)],
  };
}

async function authorizedFetch(input: {
  url: string;
  method: string;
  body?: unknown;
  saJson: string;
  fetchFn: typeof fetch;
}): Promise<Response> {
  assertGoogleMarketingUrlAllowed(input.url);
  const sa = parseGoogleServiceAccountJson(input.saJson);
  if (!sa) throw new Error("Invalid Google service account JSON");
  const token = await fetchGoogleAccessToken({
    sa,
    scope: GOOGLE_SPREADSHEETS_SCOPE,
    fetchFn: input.fetchFn,
  });
  return input.fetchFn(input.url, {
    method: input.method,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: input.body === undefined ? undefined : JSON.stringify(input.body),
  });
}

function scrubError(status: number, bodyText: string): string {
  return `Google Sheets API ${status}: ${bodyText
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/-----BEGIN[\s\S]*?PRIVATE KEY-----/gi, "[redacted-key]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200)}`;
}

/**
 * Idempotent full rewrite of "Наблюдения" + "Сводка" tabs via Sheets API v4.
 */
export async function overwriteCompetitorGoogleSheet(input: {
  observations: ObservationCsvRow[];
  /** Raw rows for summary math (need numeric price + url). */
  summarySource: Array<{
    brand: string;
    domain: string;
    url: string;
    kind: string;
    price: number | null;
    fetchedAt: string;
  }>;
  env?: NodeJS.ProcessEnv;
  fetchFn?: typeof fetch;
  now?: Date;
}): Promise<
  | {
      ok: true;
      observationRows: number;
      summaryRows: number;
    }
  | { ok: false; error: string }
> {
  const env = input.env ?? process.env;
  const spreadsheetId = env.GOOGLE_SHEETS_ID?.trim();
  const saJson = env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (!spreadsheetId || !saJson || !isGoogleSheetsExportEnabled(env)) {
    return { ok: false, error: "Google Sheets export is not configured" };
  }

  const fetchFn = input.fetchFn ?? fetch;
  const summaryRows = buildBrandSummaries(input.summarySource, input.now);
  const values = buildSheetsValues({
    observations: input.observations,
    summaryRows,
  });

  try {
    // Ensure tabs exist (ignore 400 if already present).
    for (const title of [SHEET_OBS, SHEET_SUMMARY]) {
      const addUrl = `https://www.googleapis.com/spreadsheets/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`;
      const addRes = await authorizedFetch({
        url: addUrl,
        method: "POST",
        saJson,
        fetchFn,
        body: {
          requests: [{ addSheet: { properties: { title } } }],
        },
      });
      if (!addRes.ok && addRes.status !== 400) {
        // 400 often means sheet already exists — continue.
        const text = await addRes.text().catch(() => "");
        if (!/already exists|duplicate/i.test(text)) {
          // Still proceed to clear/write; missing sheet will fail clearly.
          void text;
        }
      }
    }

    const clearUrl = `https://www.googleapis.com/spreadsheets/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchClear`;
    const clearRes = await authorizedFetch({
      url: clearUrl,
      method: "POST",
      saJson,
      fetchFn,
      body: { ranges: [`${SHEET_OBS}!A:Z`, `${SHEET_SUMMARY}!A:Z`] },
    });
    if (!clearRes.ok) {
      const text = await clearRes.text().catch(() => "");
      return { ok: false, error: scrubError(clearRes.status, text) };
    }

    const updateUrl = `https://www.googleapis.com/spreadsheets/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchUpdate`;
    const updateRes = await authorizedFetch({
      url: updateUrl,
      method: "POST",
      saJson,
      fetchFn,
      body: {
        valueInputOption: "RAW",
        data: [
          { range: `${SHEET_OBS}!A1`, values: values.observations },
          { range: `${SHEET_SUMMARY}!A1`, values: values.summary },
        ],
      },
    });
    if (!updateRes.ok) {
      const text = await updateRes.text().catch(() => "");
      return { ok: false, error: scrubError(updateRes.status, text) };
    }

    return {
      ok: true,
      observationRows: input.observations.length,
      summaryRows: summaryRows.length,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message.slice(0, 200) : "Sheets export failed";
    return {
      ok: false,
      error: message
        .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
        .replace(/-----BEGIN[\s\S]*?PRIVATE KEY-----/gi, "[redacted-key]"),
    };
  }
}
