import {
  ANALYTICS_THRESHOLDS,
  type AnalyticsThresholds,
} from "@/lib/mission-control/analytics/thresholds";
import type { AnalyticsIssue } from "@/lib/mission-control/analytics/types";

export type GaEventCount = {
  eventName: string;
  eventCount: number;
  /** Last day (YYYY-MM-DD) with any count > 0, if known. */
  lastSeenDate?: string | null;
};

export type GaTelemetryCount = {
  kind: "client_error" | "unhandled_rejection" | "web_vital" | string;
  eventCount: number;
  /** Optional poor-web-vital subset. */
  poorCount?: number;
};

export type ClarityFrictionRow = {
  url: string;
  device: string;
  deadClickCount: number;
  rageClickCount: number;
  quickbackClickCount: number;
  excessiveScrollCount: number;
  scriptErrorCount: number;
  errorClickCount: number;
};

export type DetectAnalyticsInput = {
  now: Date;
  gaEvents?: readonly GaEventCount[];
  gaTelemetry?: readonly GaTelemetryCount[];
  clarityRows?: readonly ClarityFrictionRow[];
  /** ISO date when each expected event was last observed (optional override). */
  lastSeenByEvent?: Readonly<Record<string, string | null | undefined>>;
  thresholds?: AnalyticsThresholds;
};

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function daysBetween(fromIso: string, to: Date): number {
  const from = Date.parse(`${fromIso}T00:00:00.000Z`);
  if (!Number.isFinite(from)) return Number.POSITIVE_INFINITY;
  const ms = to.getTime() - from;
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

function countByName(
  events: readonly GaEventCount[],
): Map<string, GaEventCount> {
  return new Map(events.map((row) => [row.eventName, row]));
}

/** Funnel view_item → add_to_cart → begin_checkout → purchase dropoffs. */
export function detectFunnelDropoffs(
  input: DetectAnalyticsInput,
): AnalyticsIssue[] {
  const t = input.thresholds ?? ANALYTICS_THRESHOLDS;
  const events = input.gaEvents ?? [];
  const byName = countByName(events);
  const since = isoDay(
    new Date(input.now.getTime() - t.gaLookbackDays * 24 * 60 * 60 * 1000),
  );
  const period = `last ${t.gaLookbackDays} days (GA, consented)`;
  const issues: AnalyticsIssue[] = [];

  for (let i = 1; i < t.funnelSteps.length; i += 1) {
    const prev = t.funnelSteps[i - 1];
    const next = t.funnelSteps[i];
    const prevCount = byName.get(prev)?.eventCount ?? 0;
    const nextCount = byName.get(next)?.eventCount ?? 0;
    if (prevCount < t.funnelMinPriorEvents) continue;

    const dropRatio = 1 - nextCount / prevCount;
    if (dropRatio < t.funnelDropWarnRatio) continue;

    const severity =
      dropRatio >= t.funnelDropErrorRatio ? "error" : "warning";
    const dropPct = Math.round(dropRatio * 100);

    issues.push({
      id: `funnel:${prev}->${next}`,
      kind: "funnel_dropoff",
      severity,
      title: `Funnel drop ${prev} → ${next} (${dropPct}% lost)`,
      since,
      numbers: {
        fromEvent: prev,
        toEvent: next,
        fromCount: prevCount,
        toCount: nextCount,
        dropPercent: dropPct,
      },
      whereToLook: "GA4 → Explore / funnel or Events report",
      fixHint:
        "Check storefront tracking for the lower step (consent gate, GTM tag, broken CTA). Compare consented sessions vs Clarity for the same pages.",
      source: "ga",
      period,
    });
  }

  return issues;
}

/** Breakages from synarava_telemetry (client_error, unhandled_rejection, web_vital). */
export function detectTelemetryBreakages(
  input: DetectAnalyticsInput,
): AnalyticsIssue[] {
  const t = input.thresholds ?? ANALYTICS_THRESHOLDS;
  const rows = input.gaTelemetry ?? [];
  const since = isoDay(
    new Date(input.now.getTime() - t.gaLookbackDays * 24 * 60 * 60 * 1000),
  );
  const period = `last ${t.gaLookbackDays} days (GA, consented)`;
  const issues: AnalyticsIssue[] = [];

  for (const row of rows) {
    if (row.kind === "client_error" || row.kind === "unhandled_rejection") {
      if (row.eventCount < t.telemetryErrorWarn) continue;
      const severity =
        row.eventCount >= t.telemetryErrorError ? "error" : "warning";
      issues.push({
        id: `telemetry:${row.kind}`,
        kind: "telemetry_breakage",
        severity,
        title: `Client telemetry ${row.kind}: ${row.eventCount} events`,
        since,
        numbers: { kind: row.kind, eventCount: row.eventCount },
        whereToLook:
          "GA4 → Events → synarava_telemetry (filter telemetry.kind) · browser console on affected pages",
        fixHint:
          "Reproduce the page path from event params, fix the thrown error / rejection, verify lib/telemetry/client.ts still publishes after deploy.",
        source: "ga",
        period,
      });
      continue;
    }

    if (row.kind === "web_vital") {
      const poor = row.poorCount ?? 0;
      if (poor < t.webVitalPoorWarn) continue;
      const severity =
        poor >= t.webVitalPoorError ? "error" : "warning";
      issues.push({
        id: "telemetry:web_vital",
        kind: "telemetry_breakage",
        severity,
        title: `Poor web vitals: ${poor} samples`,
        since,
        numbers: {
          kind: "web_vital",
          eventCount: row.eventCount,
          poorCount: poor,
        },
        whereToLook: "GA4 → Events → synarava_telemetry (web_vital) · CrUX / Lighthouse",
        fixHint:
          "Identify the slow route from telemetry params, reduce main-thread / LCP cost, re-check vitals after deploy.",
        source: "ga",
        period,
      });
    }
  }

  return issues;
}

/** Expected commerce events absent for N days. */
export function detectSilentEvents(
  input: DetectAnalyticsInput,
): AnalyticsIssue[] {
  const t = input.thresholds ?? ANALYTICS_THRESHOLDS;
  const events = input.gaEvents ?? [];
  const byName = countByName(events);
  const period = `silence window vs last ${t.gaLookbackDays} days (GA, consented)`;
  const issues: AnalyticsIssue[] = [];

  for (const eventName of t.expectedEvents) {
    const row = byName.get(eventName);
    const lastSeen =
      input.lastSeenByEvent?.[eventName] ??
      row?.lastSeenDate ??
      (row && row.eventCount > 0 ? isoDay(input.now) : null);

    if (lastSeen) {
      const silentDays = daysBetween(lastSeen, input.now);
      if (silentDays < t.silentEventDaysWarn) continue;
      const severity =
        silentDays >= t.silentEventDaysError ? "error" : "warning";
      issues.push({
        id: `silent:${eventName}`,
        kind: "silent_event",
        severity,
        title: `Event ${eventName} silent for ${silentDays} days`,
        since: lastSeen,
        numbers: {
          eventName,
          silentDays,
          eventCountInWindow: row?.eventCount ?? 0,
        },
        whereToLook: `GA4 → Events → ${eventName}`,
        fixHint:
          eventName === "begin_checkout"
            ? "Checkout CTA may not fire begin_checkout (see #397). Verify cart CTA + consent + GTM mapping."
            : `Confirm the ${eventName} tag still fires with consent; check GTM preview and dataLayer.`,
        source: "ga",
        period,
      });
      continue;
    }

    // Never seen in window → treat as silent for full lookback.
    const silentDays = t.gaLookbackDays;
    if (silentDays < t.silentEventDaysWarn) continue;
    const severity =
      silentDays >= t.silentEventDaysError ? "error" : "warning";
    issues.push({
      id: `silent:${eventName}`,
      kind: "silent_event",
      severity,
      title: `Event ${eventName} absent for ${silentDays}+ days`,
      since: isoDay(
        new Date(input.now.getTime() - silentDays * 24 * 60 * 60 * 1000),
      ),
      numbers: { eventName, silentDays, eventCountInWindow: 0 },
      whereToLook: `GA4 → Events → ${eventName}`,
      fixHint:
        eventName === "begin_checkout"
          ? "Checkout CTA may not fire begin_checkout (see #397). Verify cart CTA + consent + GTM mapping."
          : `Confirm the ${eventName} tag still fires with consent; check GTM preview and dataLayer.`,
      source: "ga",
      period,
    });
  }

  return issues;
}

const CLARITY_METRICS: Array<{
  key: keyof ClarityFrictionRow;
  label: string;
}> = [
  { key: "deadClickCount", label: "Dead clicks" },
  { key: "rageClickCount", label: "Rage clicks" },
  { key: "quickbackClickCount", label: "Quickback clicks" },
  { key: "excessiveScrollCount", label: "Excessive scroll" },
  { key: "scriptErrorCount", label: "Script errors" },
  { key: "errorClickCount", label: "Error clicks" },
];

/** Clarity friction by URL + device over threshold. */
export function detectClarityFriction(
  input: DetectAnalyticsInput,
): AnalyticsIssue[] {
  const t = input.thresholds ?? ANALYTICS_THRESHOLDS;
  const rows = input.clarityRows ?? [];
  const since = isoDay(
    new Date(input.now.getTime() - t.clarityNumOfDays * 24 * 60 * 60 * 1000),
  );
  const period = `last ${t.clarityNumOfDays} days (Clarity; includes bots)`;
  const issues: AnalyticsIssue[] = [];

  for (const row of rows) {
    for (const metric of CLARITY_METRICS) {
      const count = Number(row[metric.key] ?? 0);
      if (count < t.clarityFrictionWarn) continue;
      const severity =
        count >= t.clarityFrictionError ? "error" : "warning";
      const path = row.url || "(unknown url)";
      const device = row.device || "(unknown device)";
      issues.push({
        id: `clarity:${metric.key}:${path}:${device}`,
        kind: "clarity_friction",
        severity,
        title: `${metric.label} on ${path} (${device}): ${count}`,
        since,
        numbers: {
          metric: metric.label,
          count,
          url: path,
          device,
        },
        whereToLook: `Clarity → Dashboard → ${path} (${device})`,
        fixHint:
          "Open Clarity recordings for that URL/device, fix the broken control or script, re-check after deploy. Subtract bot sessions when judging traffic volume.",
        source: "clarity",
        period,
      });
    }
  }

  return issues;
}

/** Run all detectors; order is stable for snapshots. */
export function detectAnalyticsIssues(
  input: DetectAnalyticsInput,
): AnalyticsIssue[] {
  return [
    ...detectFunnelDropoffs(input),
    ...detectTelemetryBreakages(input),
    ...detectSilentEvents(input),
    ...detectClarityFriction(input),
  ];
}
