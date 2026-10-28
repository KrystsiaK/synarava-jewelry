import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";
import { useLayoutEffect } from "react";
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
  decorators: [(Story) => <div className="admin-terminal !block h-dvh"><Story /></div>],
  args: {
    nowMs: NOW.getTime(),
    catalog: MISSION_CONTROL_NODE_CATALOG,
    config: fullConfig,
    nodeStatuses: mixedStatuses,
    flowStatuses: flows,
    collectorCheckedAt: NOW,
    showPlaceholderNotice: true,
    liveEnvironment: "staging",
  },
} satisfies Meta<typeof MissionControlHub>;

export default meta;
type Story = StoryObj<typeof meta>;

function ThemeStory({ theme, children }: { theme: "light" | "dark"; children: ReactNode }) {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const applyTheme = () => {
      if (root.dataset.theme !== theme) root.dataset.theme = theme;
      if (root.style.colorScheme !== theme) root.style.colorScheme = theme;
    };
    applyTheme();
    const observer = new MutationObserver(applyTheme);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme", "style"] });
    return () => observer.disconnect();
  }, [theme]);
  return children;
}

function LightThemeDecorator(Story: () => ReactNode) {
  return <ThemeStory theme="light"><Story /></ThemeStory>;
}

function DarkThemeDecorator(Story: () => ReactNode) {
  return <ThemeStory theme="dark"><Story /></ThemeStory>;
}

export const MixedStatus: Story = {};
export const ReviewLight: Story = { decorators: [LightThemeDecorator] };
export const ReviewDark: Story = { decorators: [DarkThemeDecorator] };
export const FullArchitectureMap: Story = {};
export const SingleGroup: Story = { args: { config: appConfig, catalog: MISSION_CONTROL_NODE_CATALOG.filter((node) => appConfig.nodes.some((item) => item.widgetKey === node.widgetKey)) } };
export const TwelvePlusNodes: Story = { args: { config: twelveConfig, catalog: MISSION_CONTROL_NODE_CATALOG.filter((node) => twelveConfig.nodes.some((item) => item.widgetKey === node.widgetKey)) } };
export const VeryLongHint: Story = { args: { config: { ...fullConfig, nodes: fullConfig.nodes.map((node) => node.widgetKey === "shopify-sync" ? { ...node, fixHint: "This deliberately long hint proves remediation copy remains in the operations ledger and never stretches a map node. Check the upstream hand-off, compare the expected and observed payload, and document the first broken boundary before proposing a change." } : node) } } };
export const StaleCollector: Story = {
  args: {
    collectorCheckedAt: new Date(NOW.getTime() - 3_600_000),
    nodeStatuses: liveKeys.map((key) => status(key, "ok")),
  },
};
export const MissingCollector: Story = {
  args: {
    collectorCheckedAt: null,
    nodeStatuses: liveKeys.map((key) => status(key, "ok")),
  },
};
export const AllOk: Story = {
  args: {
    collectorCheckedAt: NOW,
    nodeStatuses: liveKeys.map((key) => status(key, "ok")),
  },
};export const AllDown: Story = { args: { nodeStatuses: liveKeys.map((key) => status(key, "down")) } };
export const ProductionView: Story = { args: { liveEnvironment: "production" } };
export const InspectorPanel: Story = { play: async ({ canvasElement }) => { canvasElement.querySelector<HTMLElement>("[data-testid='mc-node-site-health']")?.click(); } };
