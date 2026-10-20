import type { Meta, StoryObj } from "@storybook/react";
import type { WidgetPortManifest } from "@synarava/wiring-engine";
import { MissionControlHub } from "@/components/admin/mission-control/mission-control-hub";
import type { ServiceFlowStatusRecord, ServiceNodeStatusRecord, ServiceStatusLevel } from "@/lib/mission-control/status";
import type { MissionControlWiringConfig } from "@/lib/mission-control/wiring";

const NOW = new Date("2026-10-20T12:00:00.000Z");

function status(nodeKey: string, level: ServiceStatusLevel, message?: string, checkedAt = NOW): ServiceNodeStatusRecord {
  return {
    nodeKey,
    level,
    message: message ?? `${nodeKey} ${level}`,
    counters: null,
    href: `/admin/${nodeKey}`,
    checkedAt,
    updatedAt: checkedAt,
  };
}

function makeUniverse(count: number, levels: ServiceStatusLevel[]): {
  catalog: WidgetPortManifest[];
  config: MissionControlWiringConfig;
  statuses: ServiceNodeStatusRecord[];
  flows: ServiceFlowStatusRecord[];
} {
  const keys = Array.from({ length: count }, (_, index) => `service-${index + 1}`);
  const catalog: WidgetPortManifest[] = keys.map((key, index) => ({
    widgetKey: key,
    label: count === 1 ? "Synarava storefront" : `Service ${String(index + 1).padStart(2, "0")}`,
    color: "#7b5b1c",
    ports: [{ portKey: "status_out", direction: "output", valueType: "json", label: "Status" }],
  }));
  const config: MissionControlWiringConfig = {
    shellId: "mission-control-story",
    systemBindings: keys.slice(0, -1).map((key, index) => ({
      busKey: `${key}_to_${keys[index + 1]}`,
      label: `${index + 1} → ${index + 2}`,
      source: { widgetKey: key, portKey: "status_out" },
      sinks: [{ widgetKey: keys[index + 1], portKey: "status_out" }],
    })),
    userConnections: [],
    nodes: keys.map((key, index) => ({
      widgetKey: key,
      fixHint: index === 1
        ? "This deliberately long hint proves that remediation copy stays in the ledger and never stretches a map node. Check the upstream service, confirm the last successful hand-off, compare the expected payload with the observed payload, and document the first broken boundary before proposing any change."
        : `Inspect ${key} and its nearest upstream flow first.`,
      fixPrompt: `Investigate ${key} read-only and propose a safe fix.`,
    })),
  };
  const statuses = keys.map((key, index) => status(key, levels[index % levels.length]));
  const flows = config.systemBindings.map((binding, index) => ({
    busKey: binding.busKey,
    lastFlowAt: index % 2 === 0 ? new Date(NOW.getTime() - 60_000) : new Date(NOW.getTime() - 3_600_000),
    level: index % 2 === 0 ? "ok" : "warn",
    updatedAt: NOW,
  })) satisfies ServiceFlowStatusRecord[];
  return { catalog, config, statuses, flows };
}

const mixed = makeUniverse(6, ["ok", "warn", "down", "unknown"]);
const one = makeUniverse(1, ["ok"]);
const twelve = makeUniverse(12, ["ok", "warn", "down", "unknown"]);
const allOk = makeUniverse(6, ["ok"]);
const allDown = makeUniverse(6, ["down"]);

const meta = {
  title: "Admin/Mission Control/Hub",
  component: MissionControlHub,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div className="admin-terminal !block !h-auto min-h-dvh p-4 md:p-8">
        <Story />
      </div>
    ),
  ],
  args: {
    nowMs: NOW.getTime(),
    catalog: mixed.catalog,
    config: mixed.config,
    nodeStatuses: mixed.statuses,
    flowStatuses: mixed.flows,
    showPlaceholderNotice: true,
    placeholderNodeKeys: ["service-4"],
  },
} satisfies Meta<typeof MissionControlHub>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AllStates: Story = {};

export const VeryLongHint: Story = {
  args: { nodeStatuses: mixed.statuses.map((item, index) => index === 1 ? { ...item, level: "warn" } : item) },
};

export const OneNode: Story = {
  args: { catalog: one.catalog, config: one.config, nodeStatuses: one.statuses, flowStatuses: one.flows },
};

export const TwelveNodes: Story = {
  args: { catalog: twelve.catalog, config: twelve.config, nodeStatuses: twelve.statuses, flowStatuses: twelve.flows },
};

export const StaleCollector: Story = {
  args: {
    nodeStatuses: mixed.statuses.map((item) => ({ ...item, checkedAt: new Date(NOW.getTime() - 60 * 60 * 1000) })),
  },
};

export const AllOk: Story = {
  args: { catalog: allOk.catalog, config: allOk.config, nodeStatuses: allOk.statuses, flowStatuses: allOk.flows },
};

export const AllDown: Story = {
  args: { catalog: allDown.catalog, config: allDown.config, nodeStatuses: allDown.statuses, flowStatuses: allDown.flows },
};
