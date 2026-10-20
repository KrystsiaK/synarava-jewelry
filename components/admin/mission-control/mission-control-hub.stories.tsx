import type { Meta, StoryObj } from "@storybook/react";
import { MissionControlHub } from "@/components/admin/mission-control/mission-control-hub";
import { MISSION_CONTROL_NODE_CATALOG } from "@/lib/mission-control/node-catalog";
import type { ServiceFlowStatusRecord, ServiceNodeStatusRecord, ServiceStatusLevel } from "@/lib/mission-control/status";
import { getMissionControlWiringConfig, type MissionControlWiringConfig } from "@/lib/mission-control/wiring";

const NOW = new Date("2026-10-20T12:00:00.000Z");
const fullConfig = getMissionControlWiringConfig();

function status(nodeKey: string, level: ServiceStatusLevel, message?: string, checkedAt = NOW): ServiceNodeStatusRecord {
  return { nodeKey, level, message: message ?? `${nodeKey} ${level}`, counters: { checks: 24, failures: level === "ok" ? 0 : 2 }, href: `/admin/${nodeKey}`, checkedAt, updatedAt: checkedAt };
}

const liveKeys = fullConfig.nodes.filter((node) => node.kind === "live").map((node) => node.widgetKey);
const mixedStatuses = [status(liveKeys[0], "ok"), status(liveKeys[1], "warn"), status(liveKeys[2], "down")];
const flows: ServiceFlowStatusRecord[] = fullConfig.architectureBindings.map((binding, index) => ({ busKey: binding.busKey, lastFlowAt: index % 2 ? new Date(NOW.getTime() - 3_600_000) : new Date(NOW.getTime() - 60_000), level: index % 2 ? "warn" : "ok", updatedAt: NOW }));

function configForNodes(nodes: MissionControlWiringConfig["nodes"]): MissionControlWiringConfig {
  const keys = new Set(nodes.map((node) => node.widgetKey));
  const groupKeys = new Set(nodes.map((node) => node.group));
  return { ...fullConfig, groups: fullConfig.groups.filter((group) => groupKeys.has(group.key)), nodes,
    architectureBindings: fullConfig.architectureBindings.filter((binding) => binding.source && keys.has(binding.source.widgetKey) && binding.sinks.every((sink) => keys.has(sink.widgetKey))) };
}

const appConfig = configForNodes(fullConfig.nodes.filter((node) => node.group === "app"));
const twelveConfig = configForNodes(fullConfig.nodes.slice(0, 12));

const meta = {
  title: "Admin/Mission Control/Hub",
  component: MissionControlHub,
  parameters: { layout: "fullscreen" },
  decorators: [(Story) => <div className="admin-terminal !block !h-auto min-h-dvh p-4 md:p-8"><Story /></div>],
  args: { nowMs: NOW.getTime(), catalog: MISSION_CONTROL_NODE_CATALOG, config: fullConfig, nodeStatuses: mixedStatuses, flowStatuses: flows, showPlaceholderNotice: true, liveEnvironment: "staging" },
} satisfies Meta<typeof MissionControlHub>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FullArchitectureMap: Story = {};
export const SingleGroup: Story = { args: { config: appConfig, catalog: MISSION_CONTROL_NODE_CATALOG.filter((node) => appConfig.nodes.some((item) => item.widgetKey === node.widgetKey)) } };
export const TwelvePlusNodes: Story = { args: { config: twelveConfig, catalog: MISSION_CONTROL_NODE_CATALOG.filter((node) => twelveConfig.nodes.some((item) => item.widgetKey === node.widgetKey)) } };
export const VeryLongHint: Story = { args: { config: { ...fullConfig, nodes: fullConfig.nodes.map((node) => node.widgetKey === "shopify-sync" ? { ...node, fixHint: "This deliberately long hint proves remediation copy remains in the operations ledger and never stretches a map node. Check the upstream hand-off, compare the expected and observed payload, and document the first broken boundary before proposing a change." } : node) } } };
export const StaleCollector: Story = { args: { nodeStatuses: mixedStatuses.map((item) => ({ ...item, checkedAt: new Date(NOW.getTime() - 3_600_000) })) } };
export const AllOk: Story = { args: { nodeStatuses: liveKeys.map((key) => status(key, "ok")) } };
export const AllDown: Story = { args: { nodeStatuses: liveKeys.map((key) => status(key, "down")) } };
export const ProductionView: Story = { args: { liveEnvironment: "production" } };
export const NodeModal: Story = { play: async ({ canvasElement }) => { canvasElement.querySelector<HTMLElement>("[data-testid='mc-node-site-health']")?.click(); } };
