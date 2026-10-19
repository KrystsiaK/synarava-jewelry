import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MissionControlCanvas } from "@/components/admin/mission-control/mission-control-canvas";
import { MissionControlStatusNode } from "@/components/admin/mission-control/mission-control-status-node";
import { statusLevelColor } from "@/lib/mission-control/canvas-model";
import { MISSION_CONTROL_NODE_CATALOG } from "@/lib/mission-control/node-catalog";
import {
  MISSION_CONTROL_FIXTURE_NOW,
  MISSION_CONTROL_FLOW_STATUS_FIXTURES,
  MISSION_CONTROL_NODE_STATUS_FIXTURES,
} from "@/lib/mission-control/fixtures";
import { getMissionControlWiringConfig } from "@/lib/mission-control/wiring";

vi.mock("@xyflow/react", () => {
  const React = require("react") as typeof import("react");
  return {
    ReactFlowProvider: ({ children }: { children: React.ReactNode }) =>
      React.createElement("div", { "data-testid": "rf-provider" }, children),
    ReactFlow: ({
      nodes,
      edges,
      nodeTypes,
    }: {
      nodes: Array<{ id: string; type?: string; data: Record<string, unknown> }>;
      edges: Array<{ id: string; animated?: boolean; data?: { busKey?: string } }>;
      nodeTypes?: Record<
        string,
        React.ComponentType<{ data: Record<string, unknown> }>
      >;
    }) => {
      const NodeComp = nodeTypes?.missionControl;
      return React.createElement(
        "div",
        { "data-testid": "rf-mock" },
        nodes.map((node) =>
          NodeComp
            ? React.createElement(NodeComp, { key: node.id, data: node.data, id: node.id })
            : null,
        ),
        edges.map((edge) =>
          React.createElement("div", {
            key: edge.id,
            "data-testid": `rf-edge-${edge.id}`,
            "data-animated": edge.animated ? "true" : "false",
          }),
        ),
      );
    },
    Background: () => null,
  };
});

const sharedProps = {
  config: getMissionControlWiringConfig(),
  catalog: MISSION_CONTROL_NODE_CATALOG,
  nodeStatuses: MISSION_CONTROL_NODE_STATUS_FIXTURES,
  flowStatuses: MISSION_CONTROL_FLOW_STATUS_FIXTURES,
  nowMs: MISSION_CONTROL_FIXTURE_NOW.getTime(),
};

describe("MissionControlCanvas render", () => {
  it("colors graph nodes by status level", () => {
    render(<MissionControlCanvas {...sharedProps} layout="graph" />);

    const ok = screen.getByTestId("mc-node-site-health");
    expect(ok).toHaveAttribute("data-level", "ok");
    expect(ok).toHaveAttribute("data-accent", statusLevelColor("ok"));

    const warn = screen.getByTestId("mc-node-shopify-sync");
    expect(warn).toHaveAttribute("data-level", "warn");
    expect(warn).toHaveAttribute("data-accent", statusLevelColor("warn"));

    const down = screen.getByTestId("mc-node-sentry");
    expect(down).toHaveAttribute("data-level", "down");
    expect(down).toHaveAttribute("data-accent", statusLevelColor("down"));
  });

  it("marks fresh edges animated and stale edges idle", () => {
    render(<MissionControlCanvas {...sharedProps} layout="graph" />);

    expect(
      screen.getByTestId("mc-edge-site_to_db:site-health->db"),
    ).toHaveAttribute("data-animated", "true");
    expect(
      screen.getByTestId("mc-edge-shopify_to_products:shopify-sync->products"),
    ).toHaveAttribute("data-animated", "false");
    expect(
      screen.getByTestId("mc-edge-site_to_sentry:site-health->sentry"),
    ).toHaveAttribute("data-animated", "false");
  });

  it("renders a collapsible mobile list", () => {
    render(<MissionControlCanvas {...sharedProps} layout="list" />);

    expect(screen.getByTestId("mc-mobile-list")).toBeInTheDocument();
    expect(screen.getByTestId("mc-list-node-site-health")).toHaveAttribute(
      "data-level",
      "ok",
    );
    expect(screen.getByTestId("mc-list-node-sentry")).toHaveAttribute(
      "data-level",
      "down",
    );

    fireEvent.click(screen.getByTestId("mc-mobile-list-toggle"));
    expect(screen.queryByTestId("mc-mobile-list-items")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("mc-mobile-list-toggle"));
    expect(screen.getByTestId("mc-mobile-list-items")).toBeInTheDocument();
  });

  it("renders status node chrome with level accent (isolated)", () => {
    render(
      <MissionControlStatusNode
        id="site-health"
        data={{
          widgetKey: "site-health",
          label: "Site health",
          level: "ok",
          message: "pong",
          href: "/health",
          accentColor: statusLevelColor("ok"),
        }}
        type="missionControl"
        dragging={false}
        zIndex={1}
        selectable={false}
        deletable={false}
        selected={false}
        draggable={false}
        isConnectable={false}
        positionAbsoluteX={0}
        positionAbsoluteY={0}
      />,
    );
    expect(screen.getByTestId("mc-node-site-health")).toHaveAttribute(
      "data-accent",
      statusLevelColor("ok"),
    );
  });
});
