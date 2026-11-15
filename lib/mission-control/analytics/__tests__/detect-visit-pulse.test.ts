import { describe, expect, it } from "vitest";
import { detectVisitPulseIssues } from "@/lib/mission-control/analytics/detect";
import type { GaVisitPulse } from "@/lib/mission-control/analytics/ga-visit-pulse";

const NOW = new Date("2026-11-04T12:00:00.000Z");

function pulse(
  partial: Partial<GaVisitPulse> & Pick<GaVisitPulse, "current" | "previous">,
): GaVisitPulse {
  return {
    lastDaySessions: partial.lastDaySessions ?? 10,
    countries: partial.countries ?? [
      { countryId: "PT", sessions: 40, sharePct: 40 },
      { countryId: "ES", sessions: 30, sharePct: 30 },
      { countryId: "FR", sessions: 20, sharePct: 20 },
    ],
    otherSessions: partial.otherSessions ?? 0,
    otherSharePct: partial.otherSharePct ?? 0,
    previousTopCountryIds: partial.previousTopCountryIds ?? ["PT", "ES", "FR"],
    ...partial,
  };
}

describe("detectVisitPulseIssues", () => {
  it("warns when sessions drop more than 40% vs prior week (previous ≥ 50)", () => {
    const issues = detectVisitPulseIssues({
      now: NOW,
      visitPulse: pulse({
        current: {
          sessions: 50,
          activeUsers: 40,
          averageSessionDurationSec: 60,
          engagementRate: 0.3,
        },
        previous: {
          sessions: 100,
          activeUsers: 80,
          averageSessionDurationSec: 60,
          engagementRate: 0.3,
        },
      }),
    });
    const hit = issues.find((issue) => issue.id === "visit:drop");
    expect(hit?.severity).toBe("warning");
    expect(hit?.kind).toBe("visit_pulse");
    expect(hit?.numbers.dropPercent).toBe(50);
    expect(hit?.whereToLook.toLowerCase()).toMatch(
      /google analytics|ga4|acquisition/,
    );
  });

  it("does not warn for a 40% drop (threshold is strictly greater)", () => {
    const issues = detectVisitPulseIssues({
      now: NOW,
      visitPulse: pulse({
        current: {
          sessions: 60,
          activeUsers: 50,
          averageSessionDurationSec: 60,
          engagementRate: 0.3,
        },
        previous: {
          sessions: 100,
          activeUsers: 80,
          averageSessionDurationSec: 60,
          engagementRate: 0.3,
        },
      }),
    });
    expect(issues.find((issue) => issue.id === "visit:drop")).toBeUndefined();
  });

  it("does not warn on small-traffic drop (previous < 50)", () => {
    const issues = detectVisitPulseIssues({
      now: NOW,
      visitPulse: pulse({
        current: {
          sessions: 2,
          activeUsers: 2,
          averageSessionDurationSec: 60,
          engagementRate: 0.3,
        },
        previous: {
          sessions: 5,
          activeUsers: 4,
          averageSessionDurationSec: 60,
          engagementRate: 0.3,
        },
      }),
    });
    expect(issues.find((issue) => issue.id === "visit:drop")).toBeUndefined();
  });

  it("warns when previous ≥ 50 and drop > 40%", () => {
    const issues = detectVisitPulseIssues({
      now: NOW,
      visitPulse: pulse({
        current: {
          sessions: 20,
          activeUsers: 15,
          averageSessionDurationSec: 60,
          engagementRate: 0.3,
        },
        previous: {
          sessions: 50,
          activeUsers: 40,
          averageSessionDurationSec: 60,
          engagementRate: 0.3,
        },
      }),
    });
    const hit = issues.find((issue) => issue.id === "visit:drop");
    expect(hit?.severity).toBe("warning");
    expect(hit?.numbers.dropPercent).toBe(60);
  });

  it("warns when last-day sessions are 0", () => {
    const issues = detectVisitPulseIssues({
      now: NOW,
      visitPulse: pulse({
        current: {
          sessions: 100,
          activeUsers: 80,
          averageSessionDurationSec: 60,
          engagementRate: 0.3,
        },
        previous: {
          sessions: 100,
          activeUsers: 80,
          averageSessionDurationSec: 60,
          engagementRate: 0.3,
        },
        lastDaySessions: 0,
      }),
    });
    const hit = issues.find((issue) => issue.id === "visit:last_day_zero");
    expect(hit?.severity).toBe("warning");
    expect(hit?.title.toLowerCase()).toMatch(/0|нет|zero/);
  });

  it("warns when a new country appears in current top-3", () => {
    const issues = detectVisitPulseIssues({
      now: NOW,
      visitPulse: pulse({
        current: {
          sessions: 100,
          activeUsers: 80,
          averageSessionDurationSec: 60,
          engagementRate: 0.3,
        },
        previous: {
          sessions: 100,
          activeUsers: 80,
          averageSessionDurationSec: 60,
          engagementRate: 0.3,
        },
        countries: [
          { countryId: "PT", sessions: 40, sharePct: 40 },
          { countryId: "US", sessions: 30, sharePct: 30 },
          { countryId: "ES", sessions: 20, sharePct: 20 },
        ],
        previousTopCountryIds: ["PT", "ES", "FR"],
      }),
    });
    const hit = issues.find((issue) => issue.id === "visit:new_country");
    expect(hit?.severity).toBe("warning");
    expect(String(hit?.numbers.newCountries)).toContain("US");
  });

  it("skips new-country warn when prior top-3 is empty (cold start)", () => {
    const issues = detectVisitPulseIssues({
      now: NOW,
      visitPulse: pulse({
        current: {
          sessions: 10,
          activeUsers: 8,
          averageSessionDurationSec: 60,
          engagementRate: 0.3,
        },
        previous: {
          sessions: 0,
          activeUsers: 0,
          averageSessionDurationSec: 0,
          engagementRate: null,
        },
        previousTopCountryIds: [],
        lastDaySessions: 2,
      }),
    });
    expect(
      issues.find((issue) => issue.id === "visit:new_country"),
    ).toBeUndefined();
  });
});
