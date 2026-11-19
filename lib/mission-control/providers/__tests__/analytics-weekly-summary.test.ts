import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/mission-control/analytics/ga-jwt", () => ({
  parseGaServiceAccountJson: () => ({
    client_email: "bot@example.iam.gserviceaccount.com",
    private_key: "-----BEGIN PRIVATE KEY-----\nMIIE\n-----END PRIVATE KEY-----\n",
  }),
  fetchGaAccessToken: vi.fn(async () => "token"),
}));

vi.mock("@/lib/mission-control/analytics/ga-client", () => ({
  fetchGaEventCounts: vi.fn(async () => []),
  fetchGaTelemetryCounts: vi.fn(async () => []),
  fetchGaVisitPulse: vi.fn(async () => ({
    current: {
      sessions: 100,
      activeUsers: 80,
      averageSessionDurationSec: 90,
      engagementRate: 0.5,
    },
    previous: {
      sessions: 80,
      activeUsers: 60,
      averageSessionDurationSec: 80,
      engagementRate: 0.4,
    },
    lastDaySessions: 10,
    countries: [],
    otherSessions: 0,
    otherSharePct: 0,
    previousTopCountryIds: [],
  })),
  fetchGaWeeklySummary: vi.fn(async () => ({
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
    sources: [{ name: "google", sessions: 50, sharePct: 50 }],
    pages: [{ name: "/pt/shop", sessions: 40, sharePct: 40 }],
  })),
}));

import { getAnalyticsStatus } from "@/lib/mission-control/providers/analytics";

describe("getAnalyticsStatus weekly summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("persists intelligent-home href, weeklySummary, and period/source figures", async () => {
    const status = await getAnalyticsStatus({
      now: new Date("2026-11-19T12:00:00.000Z"),
      env: {
        CLARITY_API_TOKEN: null,
        GA_PROPERTY_ID: "123456789",
        GA_SERVICE_ACCOUNT_JSON: "{}",
      },
      fetchFn: vi.fn(),
      previousCounters: null,
    });

    expect(status.href).toBe(
      "https://analytics.google.com/analytics/web/#/p123456789/reports/intelligenthome",
    );
    const analytics = (status.counters as Record<string, unknown>)
      .analytics as {
      gaOpenUrl: string | null;
      weeklySummary: {
        current: { users: number; purchases: number };
        sources: Array<{ name: string }>;
        pages: Array<{ name: string }>;
      } | null;
      figures: Array<{ label: string; period: string; source: string }>;
      message: string;
      gaConsentNote: string;
    };

    expect(analytics.gaOpenUrl).toBe(status.href);
    expect(analytics.weeklySummary?.current.users).toBe(80);
    expect(analytics.weeklySummary?.current.purchases).toBe(4);
    expect(analytics.weeklySummary?.sources[0]?.name).toBe("google");
    expect(analytics.weeklySummary?.pages[0]?.name).toBe("/pt/shop");
    expect(analytics.message).toContain("GA 7д: 80 users");
    expect(analytics.gaConsentNote).toMatch(/consent/i);
    expect(
      analytics.figures.some(
        (figure) =>
          figure.label === "GA purchases / orders (7d)" &&
          figure.source === "ga" &&
          figure.period.includes("last 7 days vs prior 7"),
      ),
    ).toBe(true);
  });
});
