import { createElement, type ComponentType, type ReactNode } from "react";
import { render, screen } from "@testing-library/react";
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

const motionState = vi.hoisted(() => ({ reduced: false }));

vi.mock("motion/react", () => ({
  useReducedMotion: () => motionState.reduced,
}));

vi.mock("@xyflow/react", () => ({
  Handle: ({ isConnectable, ...props }: Record<string, unknown>) => {
    void isConnectable;
    return createElement("span", props);
  },
  Position: { Left: "left", Right: "right" },
  ReactFlowProvider: ({ children }: { children: ReactNode }) =>
    createElement("div", { "data-testid": "rf-provider" }, children),
  useNodesState: (nodes: unknown[]) => [nodes, vi.fn(), vi.fn()],
  ReactFlow: ({
    nodes,
    edges,
    nodeTypes,
  }: {
    nodes: Array<{ id: string; type?: string; data: Record<string, unknown> }>;
    edges: Array<{ id: string; animated?: boolean; data?: { busKey?: string } }>;
    nodeTypes?: Record<string, ComponentType<{ data: Record<string, unknown> }>>;
  }) => {
    const NodeComp = nodeTypes?.missionControl;
    return createElement(
      "div",
      { "data-testid": "rf-mock" },
      nodes.map((node) =>
        NodeComp
          ? createElement(NodeComp, { key: node.id, data: node.data, id: node.id })
          : null,
      ),
      edges.map((edge) =>
        createElement("div", {
          key: edge.id,
          "data-testid": `rf-edge-${edge.id}`,
          "data-animated": edge.animated ? "true" : "false",
        }),
      ),
    );
  },
  Background: () => null,
  MiniMap: () => null,
  Controls: () => null,
}));

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

    const placeholder = screen.getByTestId("mc-node-sentry");
    expect(placeholder).toHaveAttribute("data-level", "unknown");
    expect(placeholder).toHaveAttribute(
      "data-accent",
      statusLevelColor("unknown"),
    );
  });

  it("marks fresh edges animated and stale edges idle", () => {
    render(<MissionControlCanvas {...sharedProps} layout="graph" />);

    expect(
      screen.getByTestId("mc-edge-site_to_db:site-health->db"),
    ).toHaveAttribute("data-animated", "true");
    expect(
      screen.getByTestId("mc-edge-shopify_to_sync:shopify-store->shopify-sync"),
    ).toHaveAttribute("data-animated", "false");
    expect(
      screen.getByTestId("mc-edge-site_to_monitoring:site-health->sentry"),
    ).toHaveAttribute("data-animated", "false");
  });

  it("renders the same services as a mobile list without a canvas", () => {
    render(<MissionControlCanvas {...sharedProps} layout="list" />);

    expect(screen.getByTestId("mc-mobile-list")).toBeInTheDocument();
    expect(screen.getByTestId("mc-list-node-site-health")).toHaveAttribute(
      "data-level",
      "ok",
    );
    expect(screen.getByTestId("mc-list-node-sentry")).toHaveAttribute(
      "data-level",
      "unknown",
    );

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
          fixHint: "unused when ok",
          fixPrompt: "unused when ok",
          placeholder: false,
          kind: "live",
          nodeType: "service",
          group: "app",
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

  it("never renders fix hints or prompts inside node cards", () => {
    render(<MissionControlCanvas {...sharedProps} layout="graph" />);

    expect(screen.queryByTestId("mc-fix-hint-site-health")).not.toBeInTheDocument();
    expect(screen.queryByTestId("mc-fix-hint-shopify-sync")).not.toBeInTheDocument();
    expect(screen.queryByTestId("mc-copy-prompt-shopify-sync")).not.toBeInTheDocument();
    expect(screen.queryByTestId("mc-fix-hint-sentry")).not.toBeInTheDocument();
    expect(screen.queryByTestId("mc-copy-prompt-sentry")).not.toBeInTheDocument();
  });

  it("disables fresh-edge animation when reduced motion is requested", () => {
    motionState.reduced = true;
    render(<MissionControlCanvas {...sharedProps} layout="graph" />);
    expect(screen.getByTestId("mc-canvas-graph")).toHaveAttribute("data-reduced-motion", "true");
    expect(screen.getByTestId("mc-edge-site_to_db:site-health->db")).toHaveAttribute("data-animated", "false");
    motionState.reduced = false;
  });
});
