import { describe, expect, it, vi } from "vitest";
import {
  ANALYTICS_NODE_KEY,
  ANALYTICS_NOT_CONNECTED_MESSAGE,
} from "@/lib/mission-control/analytics/types";
import { getAnalyticsStatus } from "@/lib/mission-control/providers/analytics";

describe("getAnalyticsStatus", () => {
  it("returns not connected when env is missing (not ok, not error)", async () => {
    const fetchFn = vi.fn();
    const status = await getAnalyticsStatus({
      now: new Date("2026-11-04T12:00:00.000Z"),
      env: {
        CLARITY_API_TOKEN: null,
        GA_PROPERTY_ID: null,
        GA_SERVICE_ACCOUNT_JSON: null,
      },
      fetchFn,
      previousCounters: null,
    });

    expect(status.nodeKey).toBe(ANALYTICS_NODE_KEY);
    expect(status.level).toBe("unknown");
    expect(status.message).toBe(ANALYTICS_NOT_CONNECTED_MESSAGE);
    expect(status.level).not.toBe("ok");
    expect(status.level).not.toBe("down");
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("does not call Clarity when daily budget is exhausted", async () => {
    const fetchFn = vi.fn();
    // Minimal invalid SA so GA path fails closed without network if somehow called;
    // we only supply Clarity token + exhausted budget.
    const status = await getAnalyticsStatus({
      now: new Date("2026-11-04T12:00:00.000Z"),
      env: {
        CLARITY_API_TOKEN: "token-test",
        GA_PROPERTY_ID: null,
        GA_SERVICE_ACCOUNT_JSON: null,
      },
      fetchFn,
      previousCounters: {
        clarityBudgetDay: "2026-11-04",
        clarityCallsUsedToday: 4,
      },
    });

    expect(fetchFn).not.toHaveBeenCalled();
    const counters = status.counters as Record<string, unknown>;
    const analytics = counters.analytics as {
      sources: { clarity: string };
      limits: { clarityCallsUsedToday: number };
    };
    expect(analytics.sources.clarity).toBe("budget_held");
    expect(analytics.limits.clarityCallsUsedToday).toBe(4);
  });
});
