import type { Edge, Node } from "@xyflow/react";
import type { WidgetPortManifest, WiringConfig } from "@synarava/wiring-engine";
import type {
  ServiceFlowStatusRecord,
  ServiceNodeStatusRecord,
  ServiceStatusLevel,
} from "@/lib/mission-control/status";

/** Edges with `lastFlowAt` within this window count as live “electricity”. */
export const FLOW_FRESH_MS = 5 * 60 * 1000;

export const STATUS_LEVEL_COLORS: Record<ServiceStatusLevel, string> = {
  ok: "#2f6f5e",
  warn: "#b8860b",
  down: "#a33b3b",
  unknown: "#6b7280",
};

export type MissionControlNodeData = {
  widgetKey: string;
  label: string;
  level: ServiceStatusLevel;
  message: string | null;
  href: string | null;
  accentColor: string;
};

export type MissionControlCanvasNode = Node<MissionControlNodeData>;
export type MissionControlCanvasEdge = Edge;

export function statusLevelColor(level: ServiceStatusLevel): string {
  return STATUS_LEVEL_COLORS[level];
}

export function isFlowFresh(
  lastFlowAt: Date | null | undefined,
  nowMs: number = Date.now(),
  freshMs: number = FLOW_FRESH_MS,
): boolean {
  if (!lastFlowAt) return false;
  return nowMs - lastFlowAt.getTime() <= freshMs;
}

function catalogByKey(
  catalog: readonly WidgetPortManifest[],
): Map<string, WidgetPortManifest> {
  return new Map(catalog.map((entry) => [entry.widgetKey, entry]));
}

function statusByNodeKey(
  statuses: readonly ServiceNodeStatusRecord[],
): Map<string, ServiceNodeStatusRecord> {
  return new Map(statuses.map((row) => [row.nodeKey, row]));
}

function flowByBusKey(
  flows: readonly ServiceFlowStatusRecord[],
): Map<string, ServiceFlowStatusRecord> {
  return new Map(flows.map((row) => [row.busKey, row]));
}

/** Unique widget keys referenced by WiringConfig bindings (plus catalog extras). */
export function collectWidgetKeys(
  config: WiringConfig,
  catalog: readonly WidgetPortManifest[],
): string[] {
  const keys = new Set<string>();
  for (const entry of catalog) {
    keys.add(entry.widgetKey);
  }
  for (const binding of config.systemBindings) {
    if (binding.source) keys.add(binding.source.widgetKey);
    for (const sink of binding.sinks) {
      keys.add(sink.widgetKey);
    }
  }
  return [...keys];
}

function layoutPosition(index: number): { x: number; y: number } {
  const col = index % 3;
  const row = Math.floor(index / 3);
  return { x: col * 220, y: row * 120 };
}

export type BuildCanvasGraphInput = {
  config: WiringConfig;
  catalog: readonly WidgetPortManifest[];
  nodeStatuses?: readonly ServiceNodeStatusRecord[];
  flowStatuses?: readonly ServiceFlowStatusRecord[];
  nowMs?: number;
};

/**
 * Pure mapping: WiringConfig + status fixtures → React Flow nodes/edges.
 * Read-only — no drag persistence, no DB writes.
 */
export function buildCanvasGraph({
  config,
  catalog,
  nodeStatuses = [],
  flowStatuses = [],
  nowMs = Date.now(),
}: BuildCanvasGraphInput): {
  nodes: MissionControlCanvasNode[];
  edges: MissionControlCanvasEdge[];
} {
  const manifests = catalogByKey(catalog);
  const nodeStatusMap = statusByNodeKey(nodeStatuses);
  const flowStatusMap = flowByBusKey(flowStatuses);
  const widgetKeys = collectWidgetKeys(config, catalog);

  const nodes: MissionControlCanvasNode[] = widgetKeys.map((widgetKey, index) => {
    const manifest = manifests.get(widgetKey);
    const status = nodeStatusMap.get(widgetKey);
    const level: ServiceStatusLevel = status?.level ?? "unknown";
    return {
      id: widgetKey,
      type: "missionControl",
      position: layoutPosition(index),
      data: {
        widgetKey,
        label: manifest?.label ?? widgetKey,
        level,
        message: status?.message ?? null,
        href: status?.href ?? null,
        accentColor: statusLevelColor(level),
      },
      draggable: false,
      connectable: false,
      selectable: false,
    };
  });

  const edges: MissionControlCanvasEdge[] = [];
  for (const binding of config.systemBindings) {
    if (!binding.source) continue;
    const flow = flowStatusMap.get(binding.busKey);
    const animated = isFlowFresh(flow?.lastFlowAt ?? null, nowMs);
    if (binding.sinks.length === 0) continue;
    for (const sink of binding.sinks) {
      edges.push({
        id: `${binding.busKey}:${binding.source.widgetKey}->${sink.widgetKey}`,
        source: binding.source.widgetKey,
        target: sink.widgetKey,
        label: binding.label,
        animated,
        selectable: false,
        focusable: false,
        data: { busKey: binding.busKey, level: flow?.level ?? "unknown" },
      });
    }
  }

  return { nodes, edges };
}
