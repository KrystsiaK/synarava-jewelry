import { describe, expect, it } from "vitest";
import {
  buildCanvasGraph,
  isFlowFresh,
  statusLevelColor,
} from "@/lib/mission-control/canvas-model";
import { MISSION_CONTROL_NODE_CATALOG } from "@/lib/mission-control/node-catalog";
import {
  MISSION_CONTROL_FIXTURE_NOW,
  MISSION_CONTROL_FLOW_STATUS_FIXTURES,
  MISSION_CONTROL_NODE_STATUS_FIXTURES,
} from "@/lib/mission-control/fixtures";
import { getMissionControlWiringConfig } from "@/lib/mission-control/wiring";

describe("Mission Control Stage 3 canvas model", () => {
  it("maps status levels to distinct node colors", () => {
    expect(statusLevelColor("ok")).toBe("#2f6f5e");
    expect(statusLevelColor("warn")).toBe("#b8860b");
    expect(statusLevelColor("down")).toBe("#a33b3b");
    expect(statusLevelColor("unknown")).toBe("#6b7280");

    const { nodes } = buildCanvasGraph({
      config: getMissionControlWiringConfig(),
      catalog: MISSION_CONTROL_NODE_CATALOG,
      nodeStatuses: MISSION_CONTROL_NODE_STATUS_FIXTURES,
      flowStatuses: MISSION_CONTROL_FLOW_STATUS_FIXTURES,
      nowMs: MISSION_CONTROL_FIXTURE_NOW.getTime(),
    });

    const byKey = Object.fromEntries(nodes.map((n) => [n.id, n]));
    expect(byKey["site-health"].data.level).toBe("ok");
    expect(byKey["site-health"].data.accentColor).toBe(statusLevelColor("ok"));
    expect(byKey["shopify-sync"].data.level).toBe("warn");
    expect(byKey["shopify-sync"].data.accentColor).toBe(statusLevelColor("warn"));
    expect(byKey["sentry"].data.level).toBe("unknown");
    expect(byKey["sentry"].data.accentColor).toBe(statusLevelColor("unknown"));
    expect(byKey["orders"].data.level).toBe("unknown");
    expect(byKey["orders"].data.accentColor).toBe(statusLevelColor("unknown"));
  });

  it("animates only edges with a fresh lastFlowAt", () => {
    expect(isFlowFresh(new Date("2026-10-19T21:01:30.000Z"), MISSION_CONTROL_FIXTURE_NOW.getTime())).toBe(
      true,
    );
    expect(isFlowFresh(new Date("2026-10-19T20:00:00.000Z"), MISSION_CONTROL_FIXTURE_NOW.getTime())).toBe(
      false,
    );
    expect(isFlowFresh(null, MISSION_CONTROL_FIXTURE_NOW.getTime())).toBe(false);

    const { edges } = buildCanvasGraph({
      config: getMissionControlWiringConfig(),
      catalog: MISSION_CONTROL_NODE_CATALOG,
      nodeStatuses: MISSION_CONTROL_NODE_STATUS_FIXTURES,
      flowStatuses: MISSION_CONTROL_FLOW_STATUS_FIXTURES,
      nowMs: MISSION_CONTROL_FIXTURE_NOW.getTime(),
    });

    const byBus = Object.fromEntries(
      edges.map((e) => [String(e.data?.busKey), e]),
    );
    expect(byBus.site_to_db.animated).toBe(true);
    expect(byBus.shopify_to_products.animated).toBe(false);
    expect(byBus.site_to_sentry.animated).toBe(false);
  });

  it("keeps nodes non-draggable (read-only patch bay)", () => {
    const { nodes } = buildCanvasGraph({
      config: getMissionControlWiringConfig(),
      catalog: MISSION_CONTROL_NODE_CATALOG,
      nodeStatuses: MISSION_CONTROL_NODE_STATUS_FIXTURES,
    });
    expect(nodes.every((n) => n.draggable === false)).toBe(true);
    expect(nodes.every((n) => n.connectable === false)).toBe(true);
  });
});
