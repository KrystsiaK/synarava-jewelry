import { describe, expect, it } from "vitest";
import { analyticsHomeBadgeFromStatus } from "@/lib/mission-control/analytics/admin-home-badge";
import {
  ANALYTICS_NOT_CONNECTED_MESSAGE,
  GA_CONSENT_NOTE,
  CLARITY_BOT_NOTE,
} from "@/lib/mission-control/analytics/types";

function payload(partial: Record<string, unknown>) {
  return {
    connection: "connected",
    level: "ok",
    message: "ok",
    issues: [],
    notices: [],
    checkedAt: "2026-11-19T12:00:00.000Z",
    clarityDataAsOf: null,
    gaConsentNote: GA_CONSENT_NOTE,
    clarityBotNote: CLARITY_BOT_NOTE,
    limits: {
      clarityCallsUsedToday: 0,
      clarityBudgetPerDay: 4,
      clarityHardLimitPerDay: 10,
      gaLookbackDays: 28,
      clarityNumOfDays: 3,
    },
    sources: { ga: "connected", clarity: "connected" },
    figures: [],
    ...partial,
  };
}

describe("analyticsHomeBadgeFromStatus", () => {
  it("hides badge when analytics level is ok", () => {
    expect(
      analyticsHomeBadgeFromStatus({
        level: "ok",
        message: "GA 7д: healthy",
        counters: { analytics: payload({ level: "ok" }) },
      }),
    ).toEqual({ kind: "hidden" });
  });

  it("shows gray disconnected line when not connected (not an alarm)", () => {
    expect(
      analyticsHomeBadgeFromStatus({
        level: "unknown",
        message: ANALYTICS_NOT_CONNECTED_MESSAGE,
        counters: {
          analytics: payload({
            connection: "not_connected",
            level: "unknown",
            message: ANALYTICS_NOT_CONNECTED_MESSAGE,
          }),
        },
      }),
    ).toEqual({
      kind: "disconnected",
      label: "Analytics не подключён",
      href: "/admin/mission-control",
    });
  });

  it("shows compact alert with hub link for warn/error from saved state", () => {
    const badge = analyticsHomeBadgeFromStatus({
      level: "warn",
      message: "long pulse message that should not dominate",
      counters: {
        analytics: payload({
          level: "warn",
          issues: [
            {
              id: "visit:drop",
              kind: "visit_pulse",
              severity: "warning",
              title: "Sessions dropped vs prior week",
              since: "2026-11-12",
              numbers: {},
              whereToLook: "GA",
              fixHint: "Check acquisition",
              source: "ga",
              period: "last 7 days",
            },
          ],
        }),
      },
    });
    expect(badge).toEqual({
      kind: "alert",
      level: "warn",
      href: "/admin/mission-control",
      label: "Analytics: Sessions dropped vs prior week",
    });
  });

  it("treats missing stored row as disconnected, not alarm", () => {
    expect(analyticsHomeBadgeFromStatus(null)).toEqual({
      kind: "disconnected",
      label: "Analytics не подключён",
      href: "/admin/mission-control",
    });
  });
});
