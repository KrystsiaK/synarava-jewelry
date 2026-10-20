import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MissionControlNodeModal } from "@/components/admin/mission-control/mission-control-node-modal";
import { getMissionControlWiringConfig } from "@/lib/mission-control/wiring";

const NOW = new Date("2026-10-20T12:00:00.000Z");

describe("Mission Control node details", () => {
  it("shows counters, environment metadata, docs, and navigable connections", async () => {
    const user = userEvent.setup();
    const config = getMissionControlWiringConfig();
    const node = config.nodes.find((item) => item.widgetKey === "site-health")!;
    const onSelectNode = vi.fn();
    render(<MissionControlNodeModal node={node} status={{ nodeKey: node.widgetKey, level: "warn", message: "Health check slow", counters: { latencyMs: 420 }, href: "/api/health", checkedAt: NOW, updatedAt: NOW }} config={config} environment="production" liveEnvironment="staging" onClose={vi.fn()} onSelectNode={onSelectNode} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("latencyMs")).toBeInTheDocument();
    expect(screen.getByText(/Health is from the current/)).toHaveTextContent("staging");
    expect(screen.getByRole("link", { name: /Open Production/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^Postgres$/i }));
    expect(onSelectNode).toHaveBeenCalledWith("db");
  });

  it("labels missing external links as an owner TODO", () => {
    const config = getMissionControlWiringConfig();
    const node = config.nodes.find((item) => item.env.production.href === "")!;
    render(<MissionControlNodeModal node={node} config={config} environment="production" liveEnvironment="staging" onClose={vi.fn()} onSelectNode={vi.fn()} />);
    expect(screen.getAllByText(/Owner TODO/).length).toBeGreaterThan(0);
  });
});
