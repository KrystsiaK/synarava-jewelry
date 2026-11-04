import { describe, expect, it } from "vitest";
import {
  detectAnalyticsIssues,
  detectClarityFriction,
  detectFunnelDropoffs,
  detectSilentEvents,
  detectTelemetryBreakages,
} from "@/lib/mission-control/analytics/detect";
import { ANALYTICS_THRESHOLDS } from "@/lib/mission-control/analytics/thresholds";

const NOW = new Date("2026-11-04T12:00:00.000Z");

describe("analytics detection rules", () => {
  it.each([
    {
      name: "funnel warn below per-step conversion floor",
      input: {
        now: NOW,
        gaEvents: [
          { eventName: "view_item", eventCount: 1000 },
          { eventName: "add_to_cart", eventCount: 10 },
          { eventName: "begin_checkout", eventCount: 8 },
          { eventName: "purchase", eventCount: 4 },
        ],
      },
      expectIds: ["funnel:view_item->add_to_cart"],
      expectSeverity: "warning" as const,
    },
    {
      name: "funnel error when next step is zero",
      input: {
        now: NOW,
        gaEvents: [
          { eventName: "view_item", eventCount: 100 },
          { eventName: "add_to_cart", eventCount: 0 },
          { eventName: "begin_checkout", eventCount: 0 },
          { eventName: "purchase", eventCount: 0 },
        ],
      },
      expectIds: ["funnel:view_item->add_to_cart"],
      expectSeverity: "error" as const,
    },
    {
      name: "telemetry client_error warn",
      input: {
        now: NOW,
        gaTelemetry: [{ kind: "client_error" as const, eventCount: 8 }],
      },
      expectIds: ["telemetry:client_error"],
      expectSeverity: "warning" as const,
    },
    {
      name: "telemetry unhandled_rejection error",
      input: {
        now: NOW,
        gaTelemetry: [{ kind: "unhandled_rejection" as const, eventCount: 30 }],
      },
      expectIds: ["telemetry:unhandled_rejection"],
      expectSeverity: "error" as const,
    },
    {
      name: "silent begin_checkout month",
      input: {
        now: NOW,
        gaEvents: [
          { eventName: "view_item", eventCount: 50, lastSeenDate: "2026-11-03" },
          { eventName: "add_to_cart", eventCount: 20, lastSeenDate: "2026-11-02" },
          {
            eventName: "begin_checkout",
            eventCount: 0,
            lastSeenDate: "2026-10-01",
          },
          { eventName: "purchase", eventCount: 5, lastSeenDate: "2026-11-01" },
        ],
      },
      expectIds: ["silent:begin_checkout"],
      expectSeverity: "error" as const,
    },
    {
      name: "clarity rage clicks over threshold",
      input: {
        now: NOW,
        clarityRows: [
          {
            url: "/shop/ring",
            device: "Mobile",
            deadClickCount: 0,
            rageClickCount: 12,
            quickbackClickCount: 0,
            excessiveScrollCount: 0,
            scriptErrorCount: 0,
            errorClickCount: 0,
          },
        ],
      },
      expectIds: ["clarity:rageClickCount:/shop/ring:Mobile"],
      expectSeverity: "warning" as const,
    },
  ])("$name → issues + severity", ({ input, expectIds, expectSeverity }) => {
    const issues = detectAnalyticsIssues(input);
    for (const id of expectIds) {
      const found = issues.find((issue) => issue.id === id);
      expect(found, id).toBeTruthy();
      expect(found!.severity).toBe(expectSeverity);
      expect(found!.fixHint.length).toBeGreaterThan(10);
      expect(found!.whereToLook.length).toBeGreaterThan(3);
    }
  });

  it("ignores funnel noise below min prior events", () => {
    const issues = detectFunnelDropoffs({
      now: NOW,
      gaEvents: [
        { eventName: "view_item", eventCount: 5 },
        { eventName: "add_to_cart", eventCount: 0 },
        { eventName: "begin_checkout", eventCount: 0 },
        { eventName: "purchase", eventCount: 0 },
      ],
    });
    expect(issues).toEqual([]);
  });

  it("ignores telemetry below warn threshold", () => {
    expect(
      detectTelemetryBreakages({
        now: NOW,
        gaTelemetry: [
          {
            kind: "client_error",
            eventCount: ANALYTICS_THRESHOLDS.telemetryErrorWarn - 1,
          },
        ],
      }),
    ).toEqual([]);
  });

  it("flags silent event warn window", () => {
    const issues = detectSilentEvents({
      now: NOW,
      gaEvents: [
        {
          eventName: "purchase",
          eventCount: 0,
          lastSeenDate: "2026-10-20",
        },
      ],
      lastSeenByEvent: {
        view_item: "2026-11-03",
        add_to_cart: "2026-11-03",
        begin_checkout: "2026-11-03",
        purchase: "2026-10-20",
      },
    });
    const purchase = issues.find((issue) => issue.id === "silent:purchase");
    expect(purchase?.severity).toBe("warning");
  });

  it("clarity error severity above error threshold", () => {
    const issues = detectClarityFriction({
      now: NOW,
      clarityRows: [
        {
          url: "/cart",
          device: "Desktop",
          deadClickCount: 0,
          rageClickCount: 0,
          quickbackClickCount: 0,
          excessiveScrollCount: 0,
          scriptErrorCount: ANALYTICS_THRESHOLDS.clarityFrictionError,
          errorClickCount: 0,
        },
      ],
    });
    expect(issues[0]?.severity).toBe("error");
  });
});
