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
    expect(byKey["site-health"].data.fixHint).toBeTruthy();
    expect(byKey["site-health"].data.fixPrompt).toBeTruthy();
    expect(byKey["shopify-sync"].data.level).toBe("warn");
    expect(byKey["shopify-sync"].data.accentColor).toBe(statusLevelColor("warn"));
    expect(byKey["sentry"].data.level).toBe("unknown");
    expect(byKey["sentry"].data.accentColor).toBe(statusLevelColor("unknown"));
    expect(byKey["sentry"].data.kind).toBe("placeholder");
    expect(byKey["sentry"].data.fixPrompt).toBeNull();
    expect(byKey["orders"].data.level).toBe("unknown");
    expect(byKey["orders"].data.accentColor).toBe(statusLevelColor("unknown"));
  });

  it("animates continuous edges and only fresh event edges", () => {
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
    expect(byBus.shopify_to_sync.animated).toBe(false);
    expect(byBus.site_to_monitoring.animated).toBe(false);
  });

  it("allows local layout drag without allowing connections", () => {
    const { nodes } = buildCanvasGraph({
      config: getMissionControlWiringConfig(),
      catalog: MISSION_CONTROL_NODE_CATALOG,
      nodeStatuses: MISSION_CONTROL_NODE_STATUS_FIXTURES,
    });
    expect(nodes.filter((n) => n.type === "missionControl").every((n) => n.draggable === true)).toBe(true);
    expect(nodes.every((n) => n.connectable === false)).toBe(true);
  });

  it("expands and reflows groups around locally moved nodes", () => {
    const config = getMissionControlWiringConfig();
    const { nodes } = buildCanvasGraph({
      config,
      catalog: MISSION_CONTROL_NODE_CATALOG,
      positions: { "site-health": { x: 720, y: 360 } },
    });
    const app = nodes.find((node) => node.id === "group:app")!;
    const commerce = nodes.find((node) => node.id === "group:commerce")!;
    const sku = nodes.find((node) => node.id === "group:sku")!;
    expect(Number(app.style?.width)).toBeGreaterThan(config.groups[0].size.width);
    expect(Number(app.style?.height)).toBeGreaterThan(config.groups[0].size.height);
    expect(commerce.position.x).toBeGreaterThan(config.groups[1].position.x);
    expect(sku.position.y).toBeGreaterThan(config.groups[3].position.y);
  });

  it("restores locally resized groups without allowing a frame smaller than its contents", () => {
    const config = getMissionControlWiringConfig();
    const { nodes } = buildCanvasGraph({
      config,
      catalog: MISSION_CONTROL_NODE_CATALOG,
      groupSizes: {
        commerce: { width: 1240, height: 640 },
        app: { width: 100, height: 100 },
      },
    });
    const commerce = nodes.find((node) => node.id === "group:commerce")!;
    const app = nodes.find((node) => node.id === "group:app")!;
    expect(commerce.style).toMatchObject({ width: 1240, height: 640 });
    expect(Number(app.style?.width)).toBeGreaterThanOrEqual(config.groups[0].size.width);
    expect(Number(app.style?.height)).toBeGreaterThanOrEqual(config.groups[0].size.height);
  });

  it("marks configured relationships that cross group boundaries", () => {
    const { edges } = buildCanvasGraph({
      config: getMissionControlWiringConfig(),
      catalog: MISSION_CONTROL_NODE_CATALOG,
    });
    expect(edges.find((edge) => edge.data?.busKey === "site_to_monitoring")?.data?.crossGroup).toBe(true);
    expect(edges.find((edge) => edge.data?.busKey === "shopify_to_sync")?.data?.crossGroup).toBe(false);
  });
});
