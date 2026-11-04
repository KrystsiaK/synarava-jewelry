import { describe, expect, it } from "vitest";
import {
  detectFunnelDropoffs,
  detectSilentEvents,
} from "@/lib/mission-control/analytics/detect";

const NOW = new Date("2026-11-04T12:00:00.000Z");

describe("funnel thresholds (review)", () => {
  it("normal funnel 1000/60/25/10 raises no issues", () => {
    const issues = detectFunnelDropoffs({
      now: NOW,
      gaEvents: [
        { eventName: "view_item", eventCount: 1000 },
        { eventName: "add_to_cart", eventCount: 60 },
        { eventName: "begin_checkout", eventCount: 25 },
        { eventName: "purchase", eventCount: 10 },
      ],
    });
    expect(issues).toEqual([]);
  });

  it("begin_checkout=0 with add_to_cart≥N is an error (#397)", () => {
    const issues = detectFunnelDropoffs({
      now: NOW,
      gaEvents: [
        { eventName: "view_item", eventCount: 200 },
        { eventName: "add_to_cart", eventCount: 40 },
        { eventName: "begin_checkout", eventCount: 0 },
        { eventName: "purchase", eventCount: 0 },
      ],
    });
    const hit = issues.find(
      (issue) => issue.id === "funnel:add_to_cart->begin_checkout",
    );
    expect(hit?.severity).toBe("error");
  });
});

describe("purchase silence (review)", () => {
  it("purchase silent for a month is warning only, never error by age", () => {
    const issues = detectSilentEvents({
      now: NOW,
      gaEvents: [
        { eventName: "view_item", eventCount: 50, lastSeenDate: "2026-11-03" },
        { eventName: "add_to_cart", eventCount: 20, lastSeenDate: "2026-11-02" },
        {
          eventName: "begin_checkout",
          eventCount: 10,
          lastSeenDate: "2026-11-02",
        },
        {
          eventName: "purchase",
          eventCount: 0,
          lastSeenDate: "2026-10-01",
        },
      ],
    });
    const purchase = issues.find((issue) => issue.id === "silent:purchase");
    expect(purchase?.severity).toBe("warning");
    expect(purchase?.fixHint.toLowerCase()).toMatch(/no orders|shopify/);
  });
});
