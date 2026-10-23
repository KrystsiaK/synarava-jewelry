import type { Edge, Node } from "@xyflow/react";
import type { WidgetPortManifest } from "@synarava/wiring-engine";
import type { ServiceFlowStatusRecord, ServiceNodeStatusRecord, ServiceStatusLevel } from "@/lib/mission-control/status";
import type { MissionControlEnvironment, MissionControlNodeKind, MissionControlNodeType, MissionControlWiringConfig } from "@/lib/mission-control/wiring";

export const FLOW_FRESH_MS = 5 * 60 * 1000;
export const STATUS_LEVEL_COLORS: Record<ServiceStatusLevel, string> = { ok: "#2f6f5e", warn: "#b8860b", down: "#a33b3b", unknown: "#6b7280" };
export const MISSION_CONTROL_NODE_SIZE = {
  live: { width: 248, height: 132 },
  info: { width: 184, height: 48 },
  placeholder: { width: 184, height: 48 },
} as const satisfies Record<MissionControlNodeKind, { width: number; height: number }>;
export const MISSION_CONTROL_GROUP_PADDING = 24;

export type MissionControlNodeData = {
  widgetKey: string; label: string; level: ServiceStatusLevel; message: string | null; href: string | null;
  accentColor: string; fixHint: string | null; fixPrompt: string | null; placeholder: boolean;
  kind: MissionControlNodeKind; nodeType: MissionControlNodeType; group: string;
  value: string | null; checkedAt: string | null; count?: number;
};
export type MissionControlCanvasNode = Node<MissionControlNodeData>;
export type MissionControlCanvasEdge = Edge<{ busKey: string; level: ServiceStatusLevel; flow: string }>;

export function statusLevelColor(level: ServiceStatusLevel): string { return STATUS_LEVEL_COLORS[level]; }
export function isFlowFresh(lastFlowAt: Date | null | undefined, nowMs = Date.now(), freshMs = FLOW_FRESH_MS): boolean {
  return Boolean(lastFlowAt && nowMs - lastFlowAt.getTime() <= freshMs);
}
export function collectWidgetKeys(config: MissionControlWiringConfig, catalog: readonly WidgetPortManifest[]): string[] {
  const keys = new Set(config.nodes.map((node) => node.widgetKey));
  for (const entry of catalog) keys.add(entry.widgetKey);
  return [...keys];
}

export type BuildCanvasGraphInput = {
  config: MissionControlWiringConfig; catalog: readonly WidgetPortManifest[];
  nodeStatuses?: readonly ServiceNodeStatusRecord[]; flowStatuses?: readonly ServiceFlowStatusRecord[];
  nowMs?: number; environment?: MissionControlEnvironment; positions?: Readonly<Record<string, { x: number; y: number }>>;
};

const LEVEL_WEIGHT: Record<ServiceStatusLevel, number> = { down: 3, warn: 2, unknown: 1, ok: 0 };

function primaryValue(counters: ServiceNodeStatusRecord["counters"] | undefined): string | null {
  if (!counters || typeof counters !== "object" || Array.isArray(counters)) return null;
  const first = Object.values(counters)[0];
  return typeof first === "string" || typeof first === "number" ? String(first) : null;
}

/** Pure projection from versioned architecture config + request-time health into React Flow. */
export function buildCanvasGraph({ config, catalog, nodeStatuses = [], flowStatuses = [], nowMs = Date.now(), environment = "production", positions = {} }: BuildCanvasGraphInput): { nodes: MissionControlCanvasNode[]; edges: MissionControlCanvasEdge[] } {
  const manifests = new Map(catalog.map((entry) => [entry.widgetKey, entry]));
  const statuses = new Map(nodeStatuses.map((row) => [row.nodeKey, row]));
  const flows = new Map(flowStatuses.map((row) => [row.busKey, row]));
  const nodeConfig = new Map(config.nodes.map((node) => [node.widgetKey, node]));
  const groupMetrics = config.groups.map((group) => {
    const children = config.nodes.filter((node) => node.group === group.key);
    const width = Math.max(group.size.width, ...children.map((node) => {
      const position = positions[node.widgetKey] ?? node.position;
      return position.x + MISSION_CONTROL_NODE_SIZE[node.kind].width + MISSION_CONTROL_GROUP_PADDING;
    }));
    const height = Math.max(group.size.height, ...children.map((node) => {
      const position = positions[node.widgetKey] ?? node.position;
      return position.y + MISSION_CONTROL_NODE_SIZE[node.kind].height + MISSION_CONTROL_GROUP_PADDING;
    }));
    return { group, children, width, height };
  });
  const groupNodes: MissionControlCanvasNode[] = groupMetrics.map(({ group, children, width, height }) => {
    const childLevels = children.filter((node) => node.kind === "live").map((node) => statuses.get(node.widgetKey)?.level ?? "unknown");
    const worst = childLevels.sort((a, b) => LEVEL_WEIGHT[b] - LEVEL_WEIGHT[a])[0] ?? "unknown";
    const x = group.position.x + groupMetrics
      .filter((entry) => entry.group.position.y === group.position.y && entry.group.position.x < group.position.x)
      .reduce((sum, entry) => sum + Math.max(0, entry.width - entry.group.size.width), 0);
    const rowOffsets = [...new Set(groupMetrics.map((entry) => entry.group.position.y))]
      .filter((rowY) => rowY < group.position.y)
      .reduce((sum, rowY) => sum + Math.max(0, ...groupMetrics
        .filter((entry) => entry.group.position.y === rowY)
        .map((entry) => entry.height - entry.group.size.height)), 0);
    return ({
    id: `group:${group.key}`, type: "group", position: { x, y: group.position.y + rowOffsets },
    style: { width, height },
    data: { widgetKey: `group:${group.key}`, label: `${group.label} · ${children.length} · ${childLevels.length ? worst : "reference"}`, level: worst, message: null, href: null, accentColor: statusLevelColor(worst), fixHint: null, fixPrompt: null, placeholder: false, kind: "info", nodeType: "platform", group: group.key, value: null, checkedAt: null, count: children.length },
    draggable: false, connectable: false, selectable: false,
  }); });
  const serviceNodes: MissionControlCanvasNode[] = collectWidgetKeys(config, catalog).flatMap((widgetKey) => {
    const definition = nodeConfig.get(widgetKey);
    if (!definition) return [];
    const status = statuses.get(widgetKey);
    const level: ServiceStatusLevel = definition.kind === "live" ? status?.level ?? "unknown" : "unknown";
    const href = definition.env[environment].href.trim() || status?.href || null;
    return [{
      id: widgetKey, type: "missionControl", parentId: `group:${definition.group}`, extent: "parent" as const,
      position: positions[widgetKey] ?? definition.position,
      data: { widgetKey, label: definition.label ?? manifests.get(widgetKey)?.label ?? widgetKey, level,
        message: status?.message ?? (definition.kind === "placeholder" ? "Planned · not wired" : "Architecture reference"),
        href, accentColor: statusLevelColor(level), fixHint: definition.fixHint?.trim() || null,
        fixPrompt: definition.fixPrompt?.trim() || null, placeholder: definition.kind === "placeholder",
        kind: definition.kind, nodeType: definition.type, group: definition.group,
        value: primaryValue(status?.counters), checkedAt: status?.checkedAt.toISOString() ?? null },
      style: MISSION_CONTROL_NODE_SIZE[definition.kind],
      draggable: true, connectable: false, selectable: true,
    }];
  });
  const edges: MissionControlCanvasEdge[] = [];
  for (const binding of config.architectureBindings) {
    if (!binding.source) continue;
    const flowStatus = flows.get(binding.busKey);
    for (const sink of binding.sinks) edges.push({
      id: `${binding.busKey}:${binding.source.widgetKey}->${sink.widgetKey}`, source: binding.source.widgetKey, target: sink.widgetKey,
      type: "smoothstep", animated: binding.flow === "continuous" || isFlowFresh(flowStatus?.lastFlowAt, nowMs),
      markerEnd: { type: "arrowclosed", width: 14, height: 14 }, selectable: false, focusable: false,
      data: { busKey: binding.busKey, level: flowStatus?.level ?? "unknown", flow: binding.flow },
    });
  }
  return { nodes: [...groupNodes, ...serviceNodes], edges };
}
