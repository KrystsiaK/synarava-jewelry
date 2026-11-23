export type ObservationForSummary = {
  brand: string;
  domain: string;
  url: string;
  kind: string;
  price: number | null;
  fetchedAt: Date | string;
};

export type BrandSummaryRow = {
  brand: string;
  domain: string;
  productsSeen: number;
  minPrice: number | null;
  medianPrice: number | null;
  maxPrice: number | null;
  changedLast30: number;
  removedLast30: number;
  lastFetchedAt: string | null;
};

function asDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function median(sorted: number[]): number | null {
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid]!;
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/**
 * Per-brand summary for Google Sheet "Сводка" tab.
 * productsSeen = distinct URLs; price stats over priced rows;
 * changed/removed count rows in the last 30 days.
 */
export function buildBrandSummaries(
  rows: readonly ObservationForSummary[],
  now = new Date(),
): BrandSummaryRow[] {
  const cutoff30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  type Acc = {
    brand: string;
    domain: string;
    urls: Set<string>;
    prices: number[];
    changedLast30: number;
    removedLast30: number;
    lastFetchedAt: Date | null;
  };
  const byKey = new Map<string, Acc>();

  for (const row of rows) {
    let acc = byKey.get(row.domain);
    if (!acc) {
      acc = {
        brand: row.brand,
        domain: row.domain,
        urls: new Set(),
        prices: [],
        changedLast30: 0,
        removedLast30: 0,
        lastFetchedAt: null,
      };
      byKey.set(row.domain, acc);
    }
    acc.urls.add(row.url);
    const fetchedAt = asDate(row.fetchedAt);
    if (!acc.lastFetchedAt || fetchedAt > acc.lastFetchedAt) {
      acc.lastFetchedAt = fetchedAt;
    }
    if (row.price != null && Number.isFinite(row.price)) {
      acc.prices.push(row.price);
    }
    if (fetchedAt >= cutoff30) {
      if (row.kind === "changed") acc.changedLast30 += 1;
      if (row.kind === "removed") acc.removedLast30 += 1;
    }
  }

  return [...byKey.values()]
    .map((acc) => {
      const sorted = [...acc.prices].sort((a, b) => a - b);
      return {
        brand: acc.brand,
        domain: acc.domain,
        productsSeen: acc.urls.size,
        minPrice: sorted[0] ?? null,
        medianPrice: median(sorted),
        maxPrice: sorted.length ? sorted[sorted.length - 1]! : null,
        changedLast30: acc.changedLast30,
        removedLast30: acc.removedLast30,
        lastFetchedAt: acc.lastFetchedAt?.toISOString() ?? null,
      };
    })
    .sort((a, b) => a.brand.localeCompare(b.brand));
}
