import {
  ANALYTICS_THRESHOLDS,
  type AnalyticsThresholds,
  type FunnelStepKey,
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

function funnelStepKey(prev: string, next: string): FunnelStepKey {
  return `${prev}->${next}` as FunnelStepKey;
}

/**
 * Funnel view_item → add_to_cart → begin_checkout → purchase.
 * - next=0 with prior ≥ N → error (broken step, e.g. #397 begin_checkout).
 * - else warning only when conversion falls below per-step floor.
 */
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

    const stepKey = funnelStepKey(prev, next);
    const minConversion = t.funnelStepWarnMinConversion[stepKey];
    const conversion = nextCount / prevCount;
    const dropPct = Math.round((1 - conversion) * 100);

    if (nextCount === 0) {
      issues.push({
        id: `funnel:${prev}->${next}`,
        kind: "funnel_dropoff",
        severity: "error",
        title: `Funnel break ${prev} → ${next} (0 events)`,
        since,
        numbers: {
          fromEvent: prev,
          toEvent: next,
          fromCount: prevCount,
          toCount: nextCount,
          dropPercent: 100,
        },
        whereToLook: "GA4 → Explore / funnel or Events report",
        fixHint:
          next === "begin_checkout"
            ? "Checkout CTA may not fire begin_checkout (see #397). Verify cart CTA + consent + GTM mapping."
            : "Lower funnel step is silent while the prior step has volume — check tags/consent/CTA.",
        source: "ga",
        period,
      });
      continue;
    }

    if (conversion < minConversion) {
      issues.push({
        id: `funnel:${prev}->${next}`,
        kind: "funnel_dropoff",
        severity: "warning",
        title: `Funnel weak ${prev} → ${next} (${dropPct}% lost; conversion ${(conversion * 100).toFixed(1)}%)`,
        since,
        numbers: {
          fromEvent: prev,
          toEvent: next,
          fromCount: prevCount,
          toCount: nextCount,
          dropPercent: dropPct,
          conversionPercent: Number((conversion * 100).toFixed(1)),
          minConversionPercent: Math.round(minConversion * 100),
        },
        whereToLook: "GA4 → Explore / funnel or Events report",
        fixHint:
          "Conversion is below the configured per-step floor. Check storefront tracking, consent gate, and CTA — compare with Clarity for the same pages.",
        source: "ga",
        period,
      });
    }
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
        whereToLook:
          "GA4 → Events → synarava_telemetry (web_vital) · CrUX / Lighthouse",
        fixHint:
          "Identify the slow route from telemetry params, reduce main-thread / LCP cost, re-check vitals after deploy.",
        source: "ga",
        period,
      });
    }
  }

  return issues;
}

function silentSeverity(
  eventName: string,
  silentDays: number,
  t: AnalyticsThresholds,
): "warning" | "error" | null {
  if (silentDays < t.silentEventDaysWarn) return null;
  // purchase: never escalate by age (no orders OR Shopify purchase not in GA).
  if (eventName === "purchase") return "warning";
  return silentDays >= t.silentEventDaysError ? "error" : "warning";
}

function silentFixHint(eventName: string): string {
  if (eventName === "begin_checkout") {
    return "Checkout CTA may not fire begin_checkout (see #397). Verify cart CTA + consent + GTM mapping.";
  }
  if (eventName === "purchase") {
    return "No orders OR Shopify purchase event not reaching GA — check Shopify custom pixel / GTM purchase tag and consent.";
  }
  return `Confirm the ${eventName} tag still fires with consent; check GTM preview and dataLayer.`;
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
      const severity = silentSeverity(eventName, silentDays, t);
      if (!severity) continue;
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
        fixHint: silentFixHint(eventName),
        source: "ga",
        period,
      });
      continue;
    }

    const silentDays = t.gaLookbackDays;
    const severity = silentSeverity(eventName, silentDays, t);
    if (!severity) continue;
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
      fixHint: silentFixHint(eventName),
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
