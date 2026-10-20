import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  MISSION_CONTROL_PLACEHOLDER_NOTICE,
  MissionControlHub,
} from "@/components/admin/mission-control/mission-control-hub";
import type { ServiceNodeStatusRecord } from "@/lib/mission-control/status";

vi.mock("@xyflow/react", () => ({
  ReactFlowProvider: ({ children }: { children: unknown }) => children,
  ReactFlow: () => null,
  Background: () => null,
  MiniMap: () => null,
  Controls: () => null,
  useNodesState: (nodes: unknown[]) => [nodes, vi.fn(), vi.fn()],
}));

const NOW = new Date("2026-10-19T22:00:00.000Z");

const liveNode: ServiceNodeStatusRecord = {
  nodeKey: "site-health",
  level: "ok",
  message: "pong",
  counters: { latencyMs: 1 },
  href: "/api/health",
  checkedAt: NOW,
  updatedAt: NOW,
};

const placeholderNode: ServiceNodeStatusRecord = {
  nodeKey: "sentry",
  level: "unknown",
  message: "not connected",
  counters: null,
  href: "https://sentry.io",
  checkedAt: NOW,
  updatedAt: NOW,
};

function liveIssue(nodeKey: string, level: "warn" | "down" | "unknown"): ServiceNodeStatusRecord {
  return {
    ...liveNode,
    nodeKey,
    level,
    message: `${nodeKey} ${level}`,
  };
}

describe("MissionControlHub placeholder notice", () => {
  it("renders the notice while placeholder nodes remain", () => {
    render(
      <MissionControlHub
        nodeStatuses={[liveNode, placeholderNode]}
        flowStatuses={[]}
        nowMs={NOW.getTime()}
        showPlaceholderNotice
        placeholderNodeKeys={["sentry"]}
      />,
    );

    const notice = screen.getByTestId("mc-fixture-notice");
    expect(notice).toBeInTheDocument();
    expect(notice).toHaveTextContent(MISSION_CONTROL_PLACEHOLDER_NOTICE);
    expect(notice).toHaveAttribute("role", "status");
  });

  it("hides the notice when only live nodes are shown", () => {
    render(
      <MissionControlHub
        nodeStatuses={[liveNode]}
        flowStatuses={[]}
        nowMs={NOW.getTime()}
        showPlaceholderNotice={false}
      />,
    );

    expect(screen.queryByTestId("mc-fixture-notice")).not.toBeInTheDocument();
  });

  it("lists exactly warn, down, and unknown live nodes in severity order", () => {
    render(
      <MissionControlHub
        nodeStatuses={[
          liveNode,
          liveIssue("shopify-sync", "warn"),
          liveIssue("orders", "down"),
          liveIssue("db", "unknown"),
          placeholderNode,
        ]}
        flowStatuses={[]}
        nowMs={NOW.getTime()}
        placeholderNodeKeys={["sentry"]}
      />,
    );

    const items = screen.getByTestId("mc-attention-list").querySelectorAll(":scope > li");
    expect(Array.from(items).map((item) => item.getAttribute("data-testid"))).toEqual([
      "mc-attention-orders",
      "mc-attention-shopify-sync",
    ]);
    expect(screen.queryByTestId("mc-attention-site-health")).not.toBeInTheDocument();
    expect(screen.queryByTestId("mc-attention-sentry")).not.toBeInTheDocument();
    expect(screen.queryByTestId("mc-attention-db")).not.toBeInTheDocument();
  });

  it("makes a stale collector explicit", () => {
    render(
      <MissionControlHub
        nodeStatuses={[{ ...liveNode, checkedAt: new Date(NOW.getTime() - 60 * 60 * 1000) }]}
        flowStatuses={[]}
        nowMs={NOW.getTime()}
      />,
    );

    expect(screen.getByText("Collector looks stale")).toBeInTheDocument();
  });
});
