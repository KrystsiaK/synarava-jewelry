import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { GA_RESERVED_TOTAL } from "@/lib/mission-control/analytics/ga-visit-pulse";
import {
  buildGaIntelligentHomeUrl,
  formatConversionPct,
  formatWeeklySummaryMessage,
  parseGaWeeklySummary,
  type GaWeeklyReportJson,
} from "@/lib/mission-control/analytics/ga-weekly-summary";

const ROOT = process.cwd();

const OVERVIEW_DIMS = [
  { name: "sessionSource" },
  { name: "dateRange" },
] as const;
const OVERVIEW_METRICS = [
  { name: "activeUsers" },
  { name: "sessions" },
  { name: "ecommercePurchases" },
  { name: "purchaseRevenue" },
] as const;

function overviewTotal(
  range: "date_range_0" | "date_range_1",
  users: string,
  sessions: string,
  purchases: string,
  revenue: string,
) {
  return {
    dimensionValues: [{ value: GA_RESERVED_TOTAL }, { value: range }],
    metricValues: [
      { value: users },
      { value: sessions },
      { value: purchases },
      { value: revenue },
    ],
  };
}

describe("parseGaWeeklySummary", () => {
  it("parses empty GA responses as zero summary", () => {
    const summary = parseGaWeeklySummary({ overview: {}, pages: {} });
    expect(summary.current).toEqual({
      users: 0,
      sessions: 0,
      purchases: 0,
      revenue: 0,
      conversionRate: 0,
    });
    expect(summary.previous.sessions).toBe(0);
    expect(summary.sources).toEqual([]);
    expect(summary.pages).toEqual([]);
  });

  it("parses 7d vs prior totals, conversion, top sources and pages", () => {
    const overview: GaWeeklyReportJson = {
      dimensionHeaders: [...OVERVIEW_DIMS],
      metricHeaders: [...OVERVIEW_METRICS],
      rows: [
        {
          dimensionValues: [{ value: "google" }, { value: "date_range_0" }],
          metricValues: [
            { value: "40" },
            { value: "50" },
            { value: "2" },
            { value: "100" },
          ],
        },
        {
          dimensionValues: [{ value: "direct" }, { value: "date_range_0" }],
          metricValues: [
            { value: "20" },
            { value: "30" },
            { value: "1" },
            { value: "40" },
          ],
        },
        {
          dimensionValues: [{ value: "google" }, { value: "date_range_1" }],
          metricValues: [
            { value: "10" },
            { value: "20" },
            { value: "0" },
            { value: "0" },
          ],
        },
      ],
      totals: [
        overviewTotal("date_range_0", "80", "100", "4", "200.5"),
        overviewTotal("date_range_1", "60", "80", "2", "90"),
      ],
    };
    const pages: GaWeeklyReportJson = {
      dimensionHeaders: [{ name: "pagePath" }],
      metricHeaders: [{ name: "sessions" }, { name: "activeUsers" }],
      rows: [
        {
          dimensionValues: [{ value: "/pt/shop" }],
          metricValues: [{ value: "40" }, { value: "30" }],
        },
        {
          dimensionValues: [{ value: "/pt" }],
          metricValues: [{ value: "25" }, { value: "20" }],
        },
      ],
    };

    const summary = parseGaWeeklySummary({ overview, pages });
    expect(summary.current.users).toBe(80);
    expect(summary.current.sessions).toBe(100);
    expect(summary.current.purchases).toBe(4);
    expect(summary.current.revenue).toBe(200.5);
    expect(summary.current.conversionRate).toBe(0.04);
    expect(summary.previous.sessions).toBe(80);
    expect(summary.previous.purchases).toBe(2);
    expect(summary.sources[0]).toEqual({
      name: "google",
      sessions: 50,
      sharePct: 50,
    });
    expect(summary.sources[1]?.name).toBe("direct");
    expect(summary.pages[0]).toEqual({
      name: "/pt/shop",
      sessions: 40,
      sharePct: 40,
    });
  });

  it("reads date_range_0 via header index (RESERVED_TOTAL is not a range)", () => {
    const overview: GaWeeklyReportJson = {
      dimensionHeaders: [...OVERVIEW_DIMS],
      metricHeaders: [...OVERVIEW_METRICS],
      rows: [],
      totals: [
        overviewTotal("date_range_0", "10", "20", "1", "5"),
        overviewTotal("date_range_1", "5", "10", "0", "0"),
      ],
    };
    const summary = parseGaWeeklySummary({ overview, pages: {} });
    expect(summary.current.sessions).toBe(20);
    expect(summary.previous.sessions).toBe(10);
  });

  it("keeps only top 5 sources and pages", () => {
    const overview: GaWeeklyReportJson = {
      dimensionHeaders: [...OVERVIEW_DIMS],
      metricHeaders: [...OVERVIEW_METRICS],
      rows: Array.from({ length: 8 }, (_, index) => ({
        dimensionValues: [
          { value: `source-${index}` },
          { value: "date_range_0" },
        ],
        metricValues: [
          { value: "1" },
          { value: String(80 - index * 5) },
          { value: "0" },
          { value: "0" },
        ],
      })),
      totals: [overviewTotal("date_range_0", "100", "400", "0", "0")],
    };
    const pages: GaWeeklyReportJson = {
      dimensionHeaders: [{ name: "pagePath" }],
      metricHeaders: [{ name: "sessions" }],
      rows: Array.from({ length: 8 }, (_, index) => ({
        dimensionValues: [{ value: `/p${index}` }],
        metricValues: [{ value: String(80 - index * 5) }],
      })),
    };
    const summary = parseGaWeeklySummary({ overview, pages });
    expect(summary.sources).toHaveLength(5);
    expect(summary.pages).toHaveLength(5);
    expect(summary.sources[0]?.name).toBe("source-0");
    expect(summary.pages[4]?.name).toBe("/p4");
  });
});

describe("buildGaIntelligentHomeUrl", () => {
  it("builds GA4 intelligent home without NEXT_PUBLIC property id", () => {
    expect(buildGaIntelligentHomeUrl("123456789")).toBe(
      "https://analytics.google.com/analytics/web/#/p123456789/reports/intelligenthome",
    );
    expect(buildGaIntelligentHomeUrl("properties/987")).toBe(
      "https://analytics.google.com/analytics/web/#/p987/reports/intelligenthome",
    );
    const client = readFileSync(
      `${ROOT}/lib/mission-control/analytics/ga-client.ts`,
      "utf8",
    );
    expect(client).toContain("fetchGaWeeklySummary");
    expect(client).not.toContain("NEXT_PUBLIC_");
    // JWT + fetch only — no googleapis npm package (API host URL is fine).
    expect(client).not.toMatch(/from ["']googleapis["']|require\(["']googleapis["']\)/);
  });
});

describe("formatWeeklySummaryMessage", () => {
  it("formats email-like card copy with conversion", () => {
    const message = formatWeeklySummaryMessage({
      current: {
        users: 80,
        sessions: 100,
        purchases: 4,
        revenue: 200,
        conversionRate: 0.04,
      },
      previous: {
        users: 60,
        sessions: 80,
        purchases: 2,
        revenue: 90,
        conversionRate: 0.025,
      },
      sources: [],
      pages: [],
    });
    expect(message).toContain("GA 7д: 80 users · 100 sessions");
    expect(message).toMatch(/▲\s*25%/);
    expect(message).toContain("4 orders");
    expect(message).toContain(`conv ${formatConversionPct(0.04)}`);
  });
});
