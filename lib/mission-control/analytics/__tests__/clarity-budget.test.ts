import { describe, expect, it } from "vitest";
import {
  canCallClarity,
  readClarityBudgetFromCounters,
  recordClarityCall,
} from "@/lib/mission-control/analytics/clarity-budget";
import { ANALYTICS_THRESHOLDS } from "@/lib/mission-control/analytics/thresholds";

const NOW = new Date("2026-11-04T15:00:00.000Z");

describe("Clarity call budget", () => {
  it("starts at zero for a new UTC day", () => {
    const state = readClarityBudgetFromCounters(
      { clarityBudgetDay: "2026-11-03", clarityCallsUsedToday: 4 },
      NOW,
    );
    expect(state).toEqual({ day: "2026-11-04", callsUsed: 0 });
    expect(canCallClarity(state)).toBe(true);
  });

  it("holds after budget is exhausted", () => {
    const state = readClarityBudgetFromCounters(
      {
        clarityBudgetDay: "2026-11-04",
        clarityCallsUsedToday: ANALYTICS_THRESHOLDS.clarityApiBudgetPerDay,
      },
      NOW,
    );
    expect(canCallClarity(state)).toBe(false);
    expect(canCallClarity(state, ANALYTICS_THRESHOLDS.clarityApiHardLimitPerDay)).toBe(
      true,
    );
  });

  it("increments used count on record", () => {
    const next = recordClarityCall({ day: "2026-11-04", callsUsed: 2 }, 1);
    expect(next.callsUsed).toBe(3);
    expect(canCallClarity(next)).toBe(true);
  });
});
