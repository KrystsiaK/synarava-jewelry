export type ObservationCsvRow = {
  brand: string;
  domain: string;
  url: string;
  fetchedAt: string;
  kind: string;
  price: string | null;
  currency: string | null;
  availability: string | null;
  source: string;
  name: string | null;
};

export const OBSERVATION_CSV_COLUMNS = [
  "brand",
  "domain",
  "url",
  "fetchedAt",
  "kind",
  "price",
  "currency",
  "availability",
  "source",
  "name",
] as const;

const FORMULA_PREFIX = /^[=+\-@]/;

/** Guard spreadsheet formula injection — prefix dangerous cells with `'`. */
export function guardCsvCell(value: string): string {
  if (FORMULA_PREFIX.test(value)) return `'${value}`;
  return value;
}

/** RFC 4180 field quoting. */
export function quoteCsvField(raw: string): string {
  const guarded = guardCsvCell(raw);
  if (/[",\r\n]/.test(guarded)) {
    return `"${guarded.replace(/"/g, '""')}"`;
  }
  return guarded;
}

function cellValue(value: string | null | undefined): string {
  if (value == null) return "";
  return String(value);
}

export function observationToCsvCells(row: ObservationCsvRow): string[] {
  return [
    row.brand,
    row.domain,
    row.url,
    row.fetchedAt,
    row.kind,
    row.price ?? "",
    row.currency ?? "",
    row.availability ?? "",
    row.source,
    row.name ?? "",
  ].map((v) => cellValue(v));
}

/** UTF-8 CSV with BOM for Excel-friendly Cyrillic. */
export function buildObservationsCsv(rows: readonly ObservationCsvRow[]): string {
  const header = OBSERVATION_CSV_COLUMNS.map(quoteCsvField).join(",");
  const lines = rows.map((row) =>
    observationToCsvCells(row).map(quoteCsvField).join(","),
  );
  return `\uFEFF${[header, ...lines].join("\r\n")}\r\n`;
}

export type ExportPeriod = "7" | "30" | "90" | "all";

export function periodStartDate(
  period: ExportPeriod,
  now = new Date(),
): Date | null {
  if (period === "all") return null;
  const days = Number(period);
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}
