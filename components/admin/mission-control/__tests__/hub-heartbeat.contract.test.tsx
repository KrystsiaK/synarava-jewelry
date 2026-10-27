import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  COLLECTOR_STALE_MS,
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
  useReactFlow: () => ({ fitView: vi.fn(), getNode: vi.fn(), setCenter: vi.fn() }),
}));

const NOW = new Date("2026-10-27T21:00:00.000Z");

const allLiveOk: ServiceNodeStatusRecord[] = [
  "site-health",
  "shopify-sync",
  "orders",
].map((nodeKey) => ({
  nodeKey,
  level: "ok" as const,
  message: "ok",
  counters: null,
  href: `/${nodeKey}`,
  checkedAt: NOW,
  updatedAt: NOW,
}));

describe("Mission Control heartbeat contract (B3)", () => {
  it("fails all-clear when collectorCheckedAt is missing (ok live ≠ fresh cron)", () => {
    render(
      <MissionControlHub
        nodeStatuses={allLiveOk}
        flowStatuses={[]}
        nowMs={NOW.getTime()}
        collectorCheckedAt={null}
        showPlaceholderNotice={false}
      />,
    );

    expect(screen.getByText("Collector looks stale")).toBeInTheDocument();
    expect(screen.queryByText("Healthy")).not.toBeInTheDocument();
    expect(screen.getByTestId("mc-attention-empty")).toHaveAttribute(
      "data-collector-stale",
      "true",
    );
    expect(screen.getByTestId("mc-attention-empty")).not.toHaveTextContent(
      "Everything currently reporting is operational.",
    );
  });

  it("fails all-clear when collectorCheckedAt is older than COLLECTOR_STALE_MS", () => {
    const staleAt = new Date(NOW.getTime() - COLLECTOR_STALE_MS - 1);
    render(
      <MissionControlHub
        nodeStatuses={allLiveOk}
        flowStatuses={[]}
        nowMs={NOW.getTime()}
        collectorCheckedAt={staleAt}
        showPlaceholderNotice={false}
      />,
    );

    expect(screen.getByText("Collector looks stale")).toBeInTheDocument();
    const empty = screen.getByTestId("mc-attention-empty");
    expect(empty).toHaveAttribute("data-collector-stale", "true");
    expect(empty).toHaveTextContent("Collector heartbeat is stale or missing");
  });

  it("allows all-clear only with fresh collectorCheckedAt and all live ok", () => {
    render(
      <MissionControlHub
        nodeStatuses={allLiveOk}
        flowStatuses={[]}
        nowMs={NOW.getTime()}
        collectorCheckedAt={NOW}
        showPlaceholderNotice={false}
      />,
    );

    expect(screen.getByText("Collector checked")).toBeInTheDocument();
    expect(screen.getByTestId("mc-attention-empty")).toHaveAttribute(
      "data-collector-stale",
      "false",
    );
    expect(screen.getByTestId("mc-attention-empty")).toHaveTextContent(
      "Everything currently reporting is operational.",
    );
  });
});
