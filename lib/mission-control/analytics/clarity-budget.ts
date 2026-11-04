import { ANALYTICS_THRESHOLDS } from "@/lib/mission-control/analytics/thresholds";
import type { ClarityFrictionRow } from "@/lib/mission-control/analytics/detect";

export type ClarityBudgetState = {
  /** UTC calendar day YYYY-MM-DD */
  day: string;
  callsUsed: number;
  /** ISO timestamp of last successful Clarity fetch (persisted). */
  lastSuccessAt: string | null;
};

export type ClarityLastSuccessCache = {
  fetchedAt: string;
  rows: ClarityFrictionRow[];
  totalBotSessionCount: number;
  totalSessionCount: number;
};

export function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function hoursSinceLastSuccess(
  state: ClarityBudgetState,
  now: Date,
): number | null {
  if (!state.lastSuccessAt) return null;
  const then = Date.parse(state.lastSuccessAt);
  if (!Number.isFinite(then)) return null;
  return (now.getTime() - then) / (60 * 60 * 1000);
}

export function readClarityBudgetFromCounters(
  counters: unknown,
  now: Date,
): ClarityBudgetState {
  const day = utcDay(now);
  if (!counters || typeof counters !== "object" || Array.isArray(counters)) {
    return { day, callsUsed: 0, lastSuccessAt: null };
  }
  const record = counters as Record<string, unknown>;
  const storedDay =
    typeof record.clarityBudgetDay === "string" ? record.clarityBudgetDay : null;
  const used =
    typeof record.clarityCallsUsedToday === "number"
      ? record.clarityCallsUsedToday
      : 0;
  const lastSuccessAt =
    typeof record.clarityLastSuccessAt === "string"
      ? record.clarityLastSuccessAt
      : null;
  if (storedDay !== day) {
    return { day, callsUsed: 0, lastSuccessAt };
  }
  return {
    day,
    callsUsed: Math.max(0, Math.floor(used)),
    lastSuccessAt,
  };
}

function isFrictionRow(value: unknown): value is ClarityFrictionRow {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return typeof row.url === "string" && typeof row.device === "string";
}

/** Last successful Clarity payload for reuse when budget/interval holds. */
export function readClarityLastSuccessFromCounters(
  counters: unknown,
): ClarityLastSuccessCache | null {
  if (!counters || typeof counters !== "object" || Array.isArray(counters)) {
    return null;
  }
  const raw = (counters as Record<string, unknown>).clarityLastSuccess;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  if (typeof record.fetchedAt !== "string") return null;
  if (!Array.isArray(record.rows)) return null;
  const rows = record.rows.filter(isFrictionRow);
  return {
    fetchedAt: record.fetchedAt,
    rows,
    totalBotSessionCount:
      typeof record.totalBotSessionCount === "number"
        ? record.totalBotSessionCount
        : 0,
    totalSessionCount:
      typeof record.totalSessionCount === "number"
        ? record.totalSessionCount
        : 0,
  };
}

/**
 * May call Clarity when under daily budget AND ≥ min interval since last success.
 * Default interval 6h keeps ≤4 calls/day even with a 5-minute collector.
 */
export function canCallClarity(
  state: ClarityBudgetState,
  now: Date,
  budget = ANALYTICS_THRESHOLDS.clarityApiBudgetPerDay,
  minIntervalHours = ANALYTICS_THRESHOLDS.clarityMinIntervalHours,
): boolean {
  if (state.callsUsed >= budget) return false;
  const hours = hoursSinceLastSuccess(state, now);
  if (hours !== null && hours < minIntervalHours) return false;
  return true;
}

export function recordClarityCall(
  state: ClarityBudgetState,
  count = 1,
): ClarityBudgetState {
  return {
    day: state.day,
    callsUsed: state.callsUsed + count,
    lastSuccessAt: state.lastSuccessAt,
  };
}

export function recordClaritySuccess(
  state: ClarityBudgetState,
  now: Date,
): ClarityBudgetState {
  return {
    day: state.day,
    callsUsed: state.callsUsed,
    lastSuccessAt: now.toISOString(),
  };
}
