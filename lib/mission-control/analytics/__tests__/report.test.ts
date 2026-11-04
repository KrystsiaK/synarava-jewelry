import { describe, expect, it } from "vitest";
import { formatAnalyticsMarkdownReport } from "@/lib/mission-control/analytics/report";
import type { AnalyticsSnapshotPayload } from "@/lib/mission-control/analytics/types";
import {
  CLARITY_BOT_NOTE,
  GA_CONSENT_NOTE,
} from "@/lib/mission-control/analytics/types";

const FAKE: AnalyticsSnapshotPayload = {
  connection: "connected",
  level: "warn",
  message: "2 issue(s); worst=warn",
  checkedAt: "2026-11-04T12:00:00.000Z",
  notices: [],
  clarityDataAsOf: "2026-11-04T06:00:00.000Z",
  gaConsentNote: GA_CONSENT_NOTE,
  clarityBotNote: CLARITY_BOT_NOTE,
  limits: {
    clarityCallsUsedToday: 1,
    clarityBudgetPerDay: 4,
    clarityHardLimitPerDay: 10,
    gaLookbackDays: 28,
    clarityNumOfDays: 3,
  },
  sources: { ga: "connected", clarity: "connected" },
  figures: [
    {
      label: "GA event begin_checkout",
      value: 0,
      period: "last 28 days (consented)",
      source: "ga",
    },
    {
      label: "Clarity bot sessions",
      value: 120,
      period: "last 3 days",
      source: "clarity",
    },
  ],
  issues: [
    {
      id: "silent:begin_checkout",
      kind: "silent_event",
      severity: "warning",
      title: "Event begin_checkout silent for 14 days",
      since: "2026-10-21",
      numbers: { eventName: "begin_checkout", silentDays: 14, eventCountInWindow: 0 },
      whereToLook: "GA4 → Events → begin_checkout",
      fixHint: "Checkout CTA may not fire begin_checkout (see #397).",
      source: "ga",
      period: "silence window vs last 28 days (GA, consented)",
    },
    {
      id: "clarity:rageClickCount:/shop:Mobile",
      kind: "clarity_friction",
      severity: "warning",
      title: "Rage clicks on /shop (Mobile): 9",
      since: "2026-11-01",
      numbers: { metric: "Rage clicks", count: 9, url: "/shop", device: "Mobile" },
      whereToLook: "Clarity → Dashboard → /shop (Mobile)",
      fixHint: "Open Clarity recordings for that URL/device.",
      source: "clarity",
      period: "last 3 days (Clarity; includes bots)",
    },
  ],
};

describe("formatAnalyticsMarkdownReport", () => {
  it("matches snapshot on fake data", () => {
    expect(formatAnalyticsMarkdownReport(FAKE)).toMatchInlineSnapshot(`
      "# Mission Control — Analytics report

      - Date (UTC): 2026-11-04T12:00:00.000Z
      - Status: warn
      - Message: 2 issue(s); worst=warn

      ## Data limits & caveats

      - GA counts only visitors who gave analytics consent (consented share).
      - Clarity includes bots (totalBotSessionCount) — subtract or label bot sessions when reading traffic.
      - Clarity API calls used today: 1 / budget 4 (hard limit 10/project/day)
      - GA lookback: 28 days
      - Clarity window: 3 days
      - Sources: GA=connected, Clarity=connected
      - Clarity data as of 2026-11-04T06:00:00.000Z

      ## Figures

      - GA event begin_checkout: **0** · period: last 28 days (consented) · source: ga
      - Clarity bot sessions: **120** · period: last 3 days · source: clarity

      ## Issues

      ### [warning] Event begin_checkout silent for 14 days
      - Kind: silent_event
      - Since: 2026-10-21
      - Period/source: silence window vs last 28 days (GA, consented) (ga)
      - Numbers: eventName=begin_checkout, silentDays=14, eventCountInWindow=0
      - Where to look: GA4 → Events → begin_checkout
      - How to fix: Checkout CTA may not fire begin_checkout (see #397).

      ### [warning] Rage clicks on /shop (Mobile): 9
      - Kind: clarity_friction
      - Since: 2026-11-01
      - Period/source: last 3 days (Clarity; includes bots) (clarity)
      - Numbers: metric=Rage clicks, count=9, url=/shop, device=Mobile
      - Where to look: Clarity → Dashboard → /shop (Mobile)
      - How to fix: Open Clarity recordings for that URL/device.
      "
    `);
  });

  it("never includes secret-like substrings", () => {
    const md = formatAnalyticsMarkdownReport(FAKE);
    expect(md).not.toMatch(/BEGIN PRIVATE KEY|client_email|Bearer |shpat_/i);
    expect(md).not.toMatch(/@gmail\.com|password/i);
  });
});
