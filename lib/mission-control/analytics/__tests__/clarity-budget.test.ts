import { describe, expect, it } from "vitest";
import {
  canCallClarity,
  hoursSinceLastSuccess,
  readClarityBudgetFromCounters,
  readClarityLastSuccessFromCounters,
  recordClarityCall,
  recordClaritySuccess,
} from "@/lib/mission-control/analytics/clarity-budget";
import { ANALYTICS_THRESHOLDS } from "@/lib/mission-control/analytics/thresholds";
import type { ClarityFrictionRow } from "@/lib/mission-control/analytics/detect";

const NOW = new Date("2026-11-04T15:00:00.000Z");

const SAMPLE_ROWS: ClarityFrictionRow[] = [
  {
    url: "/shop",
    device: "Mobile",
    deadClickCount: 0,
    rageClickCount: 9,
    quickbackClickCount: 0,
    excessiveScrollCount: 0,
    scriptErrorCount: 0,
    errorClickCount: 0,
  },
];

describe("Clarity call budget", () => {
  it("starts at zero for a new UTC day", () => {
    const state = readClarityBudgetFromCounters(
      { clarityBudgetDay: "2026-11-03", clarityCallsUsedToday: 4 },
      NOW,
    );
    expect(state.day).toBe("2026-11-04");
    expect(state.callsUsed).toBe(0);
    expect(canCallClarity(state, NOW)).toBe(true);
  });

  it("holds after budget is exhausted", () => {
    const state = readClarityBudgetFromCounters(
      {
        clarityBudgetDay: "2026-11-04",
        clarityCallsUsedToday: ANALYTICS_THRESHOLDS.clarityApiBudgetPerDay,
      },
      NOW,
    );
    expect(canCallClarity(state, NOW)).toBe(false);
    // Hard project limit is higher — only for ops awareness, hub still uses budget 4.
    expect(
      canCallClarity(state, NOW, ANALYTICS_THRESHOLDS.clarityApiHardLimitPerDay),
    ).toBe(true);
  });

  it("increments used count on record", () => {
    const next = recordClarityCall(
      { day: "2026-11-04", callsUsed: 2, lastSuccessAt: null },
      1,
    );
    expect(next.callsUsed).toBe(3);
    expect(canCallClarity(next, NOW)).toBe(true);
  });

  it("holds when last success was <6h ago even with budget left", () => {
    const state = {
      day: "2026-11-04",
      callsUsed: 1,
      lastSuccessAt: "2026-11-04T12:00:00.000Z",
    };
    expect(hoursSinceLastSuccess(state, NOW)).toBe(3);
    expect(canCallClarity(state, NOW)).toBe(false);
    expect(
      canCallClarity(state, new Date("2026-11-04T18:00:00.000Z")),
    ).toBe(true);
  });

  it("288 collector runs/day (every 5 min) make ≤4 Clarity calls and reuse cache", () => {
    let state = {
      day: "2026-11-04",
      callsUsed: 0,
      lastSuccessAt: null as string | null,
    };
    let counters: Record<string, unknown> = {
      clarityBudgetDay: state.day,
      clarityCallsUsedToday: 0,
    };
    let clarityCalls = 0;
    const dayStart = Date.parse("2026-11-04T00:00:00.000Z");
    const fiveMinMs = 5 * 60 * 1000;

    for (let i = 0; i < 288; i += 1) {
      const now = new Date(dayStart + i * fiveMinMs);
      state = readClarityBudgetFromCounters(counters, now);
      if (canCallClarity(state, now)) {
        clarityCalls += 1;
        state = recordClarityCall(state, 1);
        state = recordClaritySuccess(state, now);
        counters = {
          ...counters,
          clarityBudgetDay: state.day,
          clarityCallsUsedToday: state.callsUsed,
          clarityLastSuccessAt: state.lastSuccessAt,
          clarityLastSuccess: {
            fetchedAt: now.toISOString(),
            rows: SAMPLE_ROWS,
            totalBotSessionCount: 10,
            totalSessionCount: 100,
          },
        };
      }
      const cached = readClarityLastSuccessFromCounters(counters);
      expect(cached?.rows.length).toBeGreaterThan(0);
    }

    expect(clarityCalls).toBeLessThanOrEqual(
      ANALYTICS_THRESHOLDS.clarityApiBudgetPerDay,
    );
    expect(clarityCalls).toBe(4);
  });
});
