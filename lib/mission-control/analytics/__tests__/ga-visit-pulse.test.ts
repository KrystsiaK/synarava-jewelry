import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  buildGaAcquisitionReportsUrl,
  formatVisitPulseMessage,
  parseGaVisitPulseReport,
  type GaVisitPulseReportJson,
} from "@/lib/mission-control/analytics/ga-visit-pulse";
import { shouldSuppressOptionalAnalytics } from "@/lib/analytics/optional-analytics-ids";

const ROOT = process.cwd();

describe("parseGaVisitPulseReport", () => {
  it("parses empty GA response as zero visits", () => {
    const pulse = parseGaVisitPulseReport({});
    expect(pulse.current.sessions).toBe(0);
    expect(pulse.current.activeUsers).toBe(0);
    expect(pulse.previous.sessions).toBe(0);
    expect(pulse.lastDaySessions).toBe(0);
    expect(pulse.countries).toEqual([]);
    expect(pulse.previousTopCountryIds).toEqual([]);
  });

  it("parses 0-session rows without throwing", () => {
    const report: GaVisitPulseReportJson = {
      dimensionHeaders: [{ name: "countryId" }, { name: "dateRange" }],
      metricHeaders: [
        { name: "sessions" },
        { name: "activeUsers" },
        { name: "averageSessionDuration" },
        { name: "engagementRate" },
      ],
      rows: [
        {
          dimensionValues: [{ value: "PT" }, { value: "date_range_0" }],
          metricValues: [
            { value: "0" },
            { value: "0" },
            { value: "0" },
            { value: "0" },
          ],
        },
      ],
      totals: [
        {
          dimensionValues: [{ value: "date_range_0" }],
          metricValues: [
            { value: "0" },
            { value: "0" },
            { value: "0" },
            { value: "0" },
          ],
        },
        {
          dimensionValues: [{ value: "date_range_1" }],
          metricValues: [
            { value: "0" },
            { value: "0" },
            { value: "0" },
            { value: "0" },
          ],
        },
        {
          dimensionValues: [{ value: "date_range_2" }],
          metricValues: [
            { value: "0" },
            { value: "0" },
            { value: "0" },
            { value: "0" },
          ],
        },
      ],
    };
    const pulse = parseGaVisitPulseReport(report);
    expect(pulse.current.sessions).toBe(0);
    expect(pulse.lastDaySessions).toBe(0);
    expect(pulse.countries.every((row) => row.sessions === 0 || row.countryId === "остальные")).toBe(
      true,
    );
  });

  it("aggregates top-5 countries + остальные and period totals", () => {
    const rows = [
      ["PT", "date_range_0", "40", "30", "120", "0.5"],
      ["ES", "date_range_0", "20", "15", "90", "0.4"],
      ["FR", "date_range_0", "15", "10", "80", "0.3"],
      ["DE", "date_range_0", "10", "8", "70", "0.2"],
      ["IT", "date_range_0", "8", "6", "60", "0.2"],
      ["US", "date_range_0", "5", "4", "50", "0.1"],
      ["BR", "date_range_0", "2", "2", "40", "0.1"],
      ["PT", "date_range_1", "50", "40", "100", "0.5"],
      ["ES", "date_range_1", "30", "20", "90", "0.4"],
      ["FR", "date_range_1", "20", "15", "80", "0.3"],
      ["PT", "date_range_2", "3", "2", "100", "0.5"],
    ] as const;

    const report: GaVisitPulseReportJson = {
      dimensionHeaders: [{ name: "countryId" }, { name: "dateRange" }],
      metricHeaders: [
        { name: "sessions" },
        { name: "activeUsers" },
        { name: "averageSessionDuration" },
        { name: "engagementRate" },
      ],
      rows: rows.map(([country, range, sessions, users, duration, eng]) => ({
        dimensionValues: [{ value: country }, { value: range }],
        metricValues: [
          { value: sessions },
          { value: users },
          { value: duration },
          { value: eng },
        ],
      })),
      totals: [
        {
          dimensionValues: [{ value: "date_range_0" }],
          metricValues: [
            { value: "100" },
            { value: "75" },
            { value: "95.5" },
            { value: "0.42" },
          ],
        },
        {
          dimensionValues: [{ value: "date_range_1" }],
          metricValues: [
            { value: "100" },
            { value: "75" },
            { value: "90" },
            { value: "0.4" },
          ],
        },
        {
          dimensionValues: [{ value: "date_range_2" }],
          metricValues: [
            { value: "3" },
            { value: "2" },
            { value: "100" },
            { value: "0.5" },
          ],
        },
      ],
    };

    const pulse = parseGaVisitPulseReport(report);
    expect(pulse.current.sessions).toBe(100);
    expect(pulse.current.activeUsers).toBe(75);
    expect(pulse.current.averageSessionDurationSec).toBeCloseTo(95.5);
    expect(pulse.current.engagementRate).toBeCloseTo(0.42);
    expect(pulse.previous.sessions).toBe(100);
    expect(pulse.lastDaySessions).toBe(3);
    expect(pulse.countries.map((c) => c.countryId)).toEqual([
      "PT",
      "ES",
      "FR",
      "DE",
      "IT",
      "остальные",
    ]);
    expect(pulse.countries[0]?.sharePct).toBe(40);
    const rest = pulse.countries.find((c) => c.countryId === "остальные");
    expect(rest?.sessions).toBe(7);
    expect(pulse.previousTopCountryIds).toEqual(["PT", "ES", "FR"]);
  });
});

describe("formatVisitPulseMessage", () => {
  it("formats Russian card copy with week-over-week delta", () => {
    const message = formatVisitPulseMessage({
      current: {
        sessions: 100,
        activeUsers: 80,
        averageSessionDurationSec: 125,
        engagementRate: 0.4,
      },
      previous: {
        sessions: 80,
        activeUsers: 70,
        averageSessionDurationSec: 100,
        engagementRate: 0.35,
      },
      lastDaySessions: 5,
      countries: [
        { countryId: "PT", sessions: 40, sharePct: 40 },
        { countryId: "ES", sessions: 20, sharePct: 20 },
        { countryId: "остальные", sessions: 40, sharePct: 40 },
      ],
      previousTopCountryIds: ["PT", "ES", "FR"],
    });
    expect(message).toContain("Визиты 7д: 100");
    expect(message).toMatch(/▲\s*25%/);
    expect(message).toContain("Посетители: 80");
    expect(message).toContain("Среднее время: 2м 5с");
    expect(message).toContain("Топ стран: PT 40%, ES 20%");
  });
});

describe("buildGaAcquisitionReportsUrl", () => {
  it("builds property Acquisition report deep link", () => {
    expect(buildGaAcquisitionReportsUrl("123456789")).toBe(
      "https://analytics.google.com/analytics/web/#/p123456789/reports/explorer?r=user-acquisition-overview",
    );
    expect(buildGaAcquisitionReportsUrl("properties/987")).toBe(
      "https://analytics.google.com/analytics/web/#/p987/reports/explorer?r=user-acquisition-overview",
    );
  });
});

describe("admin traffic exclusion (PR #398)", () => {
  it("keeps admin path / session out of storefront analytics collection", () => {
    expect(
      shouldSuppressOptionalAnalytics({
        pathname: "/admin/mission-control",
        adminSessionCookie: undefined,
      }),
    ).toBe(true);
    expect(
      shouldSuppressOptionalAnalytics({
        pathname: "/pt/shop",
        adminSessionCookie: "session.token",
      }),
    ).toBe(true);
    expect(
      shouldSuppressOptionalAnalytics({
        pathname: "/pt/shop",
        adminSessionCookie: undefined,
      }),
    ).toBe(false);
  });

  it("visit-pulse client builds runReport without re-including admin traffic", () => {
    const source = readFileSync(
      `${ROOT}/lib/mission-control/analytics/ga-client.ts`,
      "utf8",
    );
    expect(source).toContain("fetchGaVisitPulse");
    // Numbers inherit storefront exclusion from PR #398 — no admin-include filter.
    expect(source).not.toMatch(/includeAdmin|adminPath|\/admin/);
  });
});
