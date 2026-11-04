import { ANALYTICS_THRESHOLDS } from "@/lib/mission-control/analytics/thresholds";

export type ClarityBudgetState = {
  /** UTC calendar day YYYY-MM-DD */
  day: string;
  callsUsed: number;
};

export function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function readClarityBudgetFromCounters(
  counters: unknown,
  now: Date,
): ClarityBudgetState {
  const day = utcDay(now);
  if (!counters || typeof counters !== "object" || Array.isArray(counters)) {
    return { day, callsUsed: 0 };
  }
  const record = counters as Record<string, unknown>;
  const storedDay =
    typeof record.clarityBudgetDay === "string" ? record.clarityBudgetDay : null;
  const used =
    typeof record.clarityCallsUsedToday === "number"
      ? record.clarityCallsUsedToday
      : 0;
  if (storedDay !== day) return { day, callsUsed: 0 };
  return { day, callsUsed: Math.max(0, Math.floor(used)) };
}

export function canCallClarity(
  state: ClarityBudgetState,
  budget = ANALYTICS_THRESHOLDS.clarityApiBudgetPerDay,
): boolean {
  return state.callsUsed < budget;
}

export function recordClarityCall(
  state: ClarityBudgetState,
  count = 1,
): ClarityBudgetState {
  return {
    day: state.day,
    callsUsed: state.callsUsed + count,
  };
}
