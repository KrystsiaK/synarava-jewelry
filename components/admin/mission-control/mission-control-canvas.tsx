"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { Background, Controls, NodeResizeControl, ReactFlow, ReactFlowProvider, useNodesState, useReactFlow, type NodeProps, type NodeTypes } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { WidgetPortManifest } from "@synarava/wiring-engine";
import { MissionControlMobileList } from "@/components/admin/mission-control/mission-control-mobile-list";
import { MissionControlStatusNode } from "@/components/admin/mission-control/mission-control-status-node";
import { MissionControlStatusMark } from "@/components/admin/mission-control/mission-control-status-mark";
import { buildCanvasGraph, MISSION_CONTROL_GROUP_PADDING, type MissionControlCanvasEdge, type MissionControlCanvasNode } from "@/lib/mission-control/canvas-model";
import { loadMissionControlGroupSizes, loadMissionControlLayout, resetMissionControlLayout, saveMissionControlGroupSizes, saveMissionControlLayout } from "@/lib/mission-control/layout-storage";
import type { ServiceFlowStatusRecord, ServiceNodeStatusRecord } from "@/lib/mission-control/status";
import type { MissionControlEnvironment, MissionControlWiringConfig } from "@/lib/mission-control/wiring";

function MissionControlGroupNode({ data }: NodeProps<MissionControlCanvasNode>) {
  const title = data.label.split(" · ")[0];
  return <>
    <div className="mc-group-header"><strong>{title}</strong><span>{data.count} nodes</span>{data.level !== "unknown" ? <MissionControlStatusMark level={data.level} compact /> : <span>Reference</span>}</div>
    {data.onGroupResize ? <NodeResizeControl
      className="mc-group-resize"
      position="bottom-right"
      minWidth={data.minWidth}
      minHeight={data.minHeight}
      onResizeEnd={(_, params) => data.onGroupResize?.(data.group, params.width, params.height)}
    ><span className="sr-only">Resize {title}</span></NodeResizeControl> : null}
  </>;
}

const NODE_TYPES: NodeTypes = { missionControl: MissionControlStatusNode, group: MissionControlGroupNode };
export type MissionControlCanvasLayout = "auto" | "graph" | "list";

export type MissionControlCanvasProps = {
  config: MissionControlWiringConfig;
  catalog: readonly WidgetPortManifest[];
  nodeStatuses?: readonly ServiceNodeStatusRecord[];
  flowStatuses?: readonly ServiceFlowStatusRecord[];
  nowMs?: number;
  placeholderNodeKeys?: readonly string[];
  layout?: MissionControlCanvasLayout;
  environment?: MissionControlEnvironment;
  resetNonce?: number;
  fitNonce?: number;
  focusNodeKey?: string;
  selectedNodeKey?: string | null;
  onSelectNode?: (widgetKey: string) => void;
};

type GraphPaneProps = {
  nodes: MissionControlCanvasNode[];
  edges: MissionControlCanvasEdge[];
  config: MissionControlWiringConfig;
  environment: MissionControlEnvironment;
  resetNonce: number;
  fitNonce: number;
  focusNodeKey?: string;
  selectedNodeKey?: string | null;
  onSelectNode?: (widgetKey: string) => void;
};

function GraphPaneInner({ nodes, edges, config, environment, resetNonce, fitNonce, focusNodeKey, selectedNodeKey, onSelectNode }: GraphPaneProps) {
  const reduceMotion = useReducedMotion();
  const flow = useReactFlow();
  const [renderedNodes, setRenderedNodes, onNodesChange] = useNodesState(nodes);
  const [hoveredNodeKey, setHoveredNodeKey] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<ReadonlySet<string>>(() => new Set());
  const dragOrigin = useRef(new Map<string, { x: number; y: number }>());
  const previousFitNonce = useRef(fitNonce);
  const renderedEdges = useMemo(() => edges.map((edge) => ({ ...edge, animated: Boolean(edge.animated) && !reduceMotion })), [edges, reduceMotion]);
  const collapsedGroups = useMemo(() => new Set(config.groups.filter((group) => {
    const children = config.nodes.filter((node) => node.group === group.key);
    return children.length > 0 && children.every((node) => node.kind !== "live") && !expandedGroups.has(group.key);
  }).map((group) => group.key)), [config, expandedGroups]);
  const emphasisKey = hoveredNodeKey ?? selectedNodeKey ?? null;
  const connectedKeys = useMemo(() => {
    if (!emphasisKey) return new Set<string>();
    const result = new Set([emphasisKey]);
    for (const edge of edges) {
      if (edge.source === emphasisKey) result.add(edge.target);
      if (edge.target === emphasisKey) result.add(edge.source);
    }
    return result;
  }, [edges, emphasisKey]);

  useEffect(() => setRenderedNodes(nodes), [nodes, setRenderedNodes]);
  useEffect(() => {
    if (!resetNonce) return;
    resetMissionControlLayout(window.localStorage, config.version, environment);
    setRenderedNodes(nodes);
  }, [resetNonce, config.version, environment, nodes, setRenderedNodes]);
  useEffect(() => {
    const explicitFit = fitNonce !== previousFitNonce.current;
    previousFitNonce.current = fitNonce;
    const liveGroups = config.groups
      .filter((group) => config.nodes.some((node) => node.group === group.key && node.kind === "live"))
      .map((group) => ({ id: `group:${group.key}` }));
    flow.fitView({ duration: reduceMotion ? 0 : 320, padding: 0.1, nodes: explicitFit ? undefined : liveGroups });
  }, [config, environment, fitNonce, flow, reduceMotion]);
  useEffect(() => {
    if (!focusNodeKey) return;
    const node = flow.getNode(focusNodeKey);
    if (!node) return;
    const x = node.position.x + (node.measured?.width ?? 0) / 2;
    const y = node.position.y + (node.measured?.height ?? 0) / 2;
    flow.setCenter(x, y, { zoom: 1, duration: reduceMotion ? 0 : 320 });
  }, [focusNodeKey, flow, reduceMotion]);

  const persistNodes = useCallback((nextNodes: MissionControlCanvasNode[]) => {
    const positions = Object.fromEntries(nextNodes.filter((node) => node.type === "missionControl").map((node) => [node.id, node.position]));
    const groupSizes = Object.fromEntries(nextNodes.filter((node) => node.type === "group").map((node) => [String(node.data.group), { width: Number(node.style?.width ?? node.measured?.width ?? 0), height: Number(node.style?.height ?? node.measured?.height ?? 0) }]));
    saveMissionControlLayout(window.localStorage, config.version, environment, positions);
    saveMissionControlGroupSizes(window.localStorage, config.version, environment, groupSizes);
  }, [config.version, environment]);

  const handleGroupResize = useCallback((groupKey: string, width: number, height: number) => {
    setRenderedNodes((current) => {
      const group = current.find((node) => node.id === `group:${groupKey}`);
      if (!group) return current;
      const widthDelta = width - Number(group.style?.width ?? 0);
      const heightDelta = height - Number(group.style?.height ?? 0);
      const next = current.map((node) => {
        if (node.id === group.id) return { ...node, style: { ...node.style, width, height } };
        if (node.type !== "group") return node;
        const sameRow = Math.abs(node.position.y - group.position.y) < 24;
        return { ...node, position: {
          x: sameRow && node.position.x > group.position.x ? node.position.x + widthDelta : node.position.x,
          y: node.position.y > group.position.y ? node.position.y + heightDelta : node.position.y,
        } };
      });
      persistNodes(next);
      return next;
    });
  }, [persistNodes, setRenderedNodes]);

  const handleNodeDragStop = useCallback((_: unknown, node: MissionControlCanvasNode) => {
    const nodeWidth = Number(node.style?.width ?? 0);
    const nodeHeight = Number(node.style?.height ?? 0);
    const overlapsSibling = renderedNodes.some((other) => {
      if (other.id === node.id || other.type !== "missionControl" || other.parentId !== node.parentId) return false;
      const otherWidth = Number(other.style?.width ?? 0);
      const otherHeight = Number(other.style?.height ?? 0);
      const gap = 16;
      return node.position.x < other.position.x + otherWidth + gap
        && node.position.x + nodeWidth + gap > other.position.x
        && node.position.y < other.position.y + otherHeight + gap
        && node.position.y + nodeHeight + gap > other.position.y;
    });
    const origin = dragOrigin.current.get(node.id);
    const nextNodes = renderedNodes.map((entry) => entry.id === node.id
      ? { ...entry, position: overlapsSibling && origin ? origin : node.position }
      : entry);
    dragOrigin.current.delete(node.id);
    setRenderedNodes(nextNodes);
    persistNodes(nextNodes);
  }, [persistNodes, renderedNodes, setRenderedNodes]);

  const handleNodeDrag = useCallback((_: unknown, node: MissionControlCanvasNode) => {
    setRenderedNodes((current) => {
      const parent = current.find((entry) => entry.id === node.parentId);
      if (!parent) return current;
      const currentWidth = Number(parent.style?.width ?? 0);
      const currentHeight = Number(parent.style?.height ?? 0);
      const requiredWidth = node.position.x + Number(node.style?.width ?? 0) + MISSION_CONTROL_GROUP_PADDING;
      const requiredHeight = node.position.y + Number(node.style?.height ?? 0) + MISSION_CONTROL_GROUP_PADDING;
      const nextWidth = Math.max(currentWidth, Math.ceil(requiredWidth / 24) * 24);
      const nextHeight = Math.max(currentHeight, Math.ceil(requiredHeight / 24) * 24);
      const widthDelta = nextWidth - currentWidth;
      const heightDelta = nextHeight - currentHeight;
      if (!widthDelta && !heightDelta) return current;
      return current.map((entry) => {
        if (entry.id === parent.id) return { ...entry, style: { ...entry.style, width: nextWidth, height: nextHeight } };
        if (entry.type !== "group") return entry;
        const sameRow = Math.abs(entry.position.y - parent.position.y) < 24;
        return { ...entry, position: {
          x: sameRow && entry.position.x > parent.position.x ? entry.position.x + widthDelta : entry.position.x,
          y: entry.position.y > parent.position.y ? entry.position.y + heightDelta : entry.position.y,
        } };
      });
    });
  }, [setRenderedNodes]);

  const expandedGroupBottom = Math.max(0, ...renderedNodes
    .filter((node) => node.type === "group" && !collapsedGroups.has(String(node.data.group)))
    .map((node) => node.position.y + Number(node.style?.height ?? 0)));
  const collapsedGroupOrder = config.groups.filter((group) => collapsedGroups.has(group.key)).map((group) => group.key);
  const visibleNodes = renderedNodes.filter((node) => node.type === "group" || !collapsedGroups.has(String(node.data.group))).map((node) => {
    const collapsed = node.type === "group" && collapsedGroups.has(String(node.data.group));
    const collapsedIndex = collapsedGroupOrder.indexOf(String(node.data.group));
    return {
      ...node,
      position: collapsed ? { x: collapsedIndex * 300, y: expandedGroupBottom + 72 } : node.position,
      data: node.type === "group" ? { ...node.data, onGroupResize: collapsed ? undefined : handleGroupResize } : node.data,
      className: node.type === "group" ? `mc-group-node${collapsed ? " is-collapsed" : ""}` : emphasisKey && !connectedKeys.has(node.id) ? "is-dimmed" : connectedKeys.has(node.id) ? "is-connected" : undefined,
      style: collapsed ? { ...node.style, width: 270, height: 54 } : node.style,
    };
  });
  const visibleNodeKeys = new Set(visibleNodes.map((node) => node.id));
  const groupByNode = new Map(config.nodes.map((node) => [node.widgetKey, node.group]));
  const projectedEdges = [...new Map(renderedEdges.map((edge) => {
    const sourceGroup = groupByNode.get(edge.source);
    const targetGroup = groupByNode.get(edge.target);
    const source = sourceGroup && collapsedGroups.has(sourceGroup) ? `group:${sourceGroup}` : edge.source;
    const target = targetGroup && collapsedGroups.has(targetGroup) ? `group:${targetGroup}` : edge.target;
    const projected = { ...edge, id: source === edge.source && target === edge.target ? edge.id : `summary:${source}->${target}:${edge.data?.busKey}`, source, target };
    return [`${source}:${target}:${edge.data?.busKey}`, projected] as const;
  })).values()];
  const visibleEdges = projectedEdges.filter((edge) => edge.source !== edge.target && visibleNodeKeys.has(edge.source) && visibleNodeKeys.has(edge.target)).map((edge) => {
    const highlighted = Boolean(emphasisKey && (edge.source === emphasisKey || edge.target === emphasisKey));
    const active = edge.data?.level === "warn" || edge.data?.level === "down" || edge.animated;
    const classes = [highlighted ? "is-highlighted" : emphasisKey ? "is-dimmed" : active ? "is-active" : "", edge.data?.crossGroup ? "is-cross-group" : ""].filter(Boolean).join(" ");
    return { ...edge, label: highlighted || active || edge.data?.crossGroup ? edge.data?.busKey.replaceAll("_", " ") : undefined, className: classes || undefined };
  });

  return (
    <div className="mc-canvas-graph" data-testid="mc-canvas-graph" data-reduced-motion={reduceMotion ? "true" : "false"}>
      <ReactFlow nodes={visibleNodes} edges={visibleEdges} nodeTypes={NODE_TYPES} onNodesChange={onNodesChange}
        onNodeDragStart={(_, node) => dragOrigin.current.set(node.id, node.position)} onNodeDrag={handleNodeDrag} onNodeDragStop={handleNodeDragStop}
        onNodeClick={(_, node) => { if (node.type === "group") { const key = String(node.data.group); setExpandedGroups((current) => { const next = new Set(current); if (next.has(key)) next.delete(key); else next.add(key); return next; }); } else onSelectNode?.(node.id); }}
        onNodeMouseEnter={(_, node) => node.type === "missionControl" && setHoveredNodeKey(node.id)} onNodeMouseLeave={() => setHoveredNodeKey(null)}
        nodesDraggable nodesConnectable={false} elementsSelectable edgesFocusable={false} nodesFocusable panOnDrag zoomOnScroll minZoom={0.4} maxZoom={1.5} proOptions={{ hideAttribution: false }}>
        <Background gap={24} size={1} /><Controls showInteractive={false} />
      </ReactFlow>
      <ul className="sr-only" data-testid="mc-edge-meta" aria-hidden>{renderedEdges.map((edge) => <li key={edge.id} data-testid={`mc-edge-${edge.id}`} data-animated={edge.animated ? "true" : "false"} data-bus={String(edge.data?.busKey ?? "")} />)}</ul>
    </div>
  );
}

function GraphPane(props: GraphPaneProps) { return <ReactFlowProvider><GraphPaneInner {...props} /></ReactFlowProvider>; }

export function MissionControlCanvas({ config, catalog, nodeStatuses = [], flowStatuses = [], nowMs, layout = "auto", environment = "production", resetNonce = 0, fitNonce = 0, focusNodeKey, selectedNodeKey, onSelectNode }: MissionControlCanvasProps) {
  const positions = useMemo(() => typeof window === "undefined" ? {} : loadMissionControlLayout(window.localStorage, config.version, environment), [config.version, environment]);
  const groupSizes = useMemo(() => typeof window === "undefined" ? {} : loadMissionControlGroupSizes(window.localStorage, config.version, environment), [config.version, environment]);
  const { nodes, edges } = useMemo(() => buildCanvasGraph({ config, catalog, nodeStatuses, flowStatuses, nowMs, environment, positions, groupSizes }), [config, catalog, nodeStatuses, flowStatuses, nowMs, environment, positions, groupSizes]);
  const graphProps = { nodes, edges, config, environment, resetNonce, fitNonce, focusNodeKey, selectedNodeKey, onSelectNode };
  if (layout === "list") return <MissionControlMobileList nodes={nodes} edges={edges} onSelectNode={onSelectNode} />;
  if (layout === "graph") return <GraphPane {...graphProps} />;
  return <div className="mc-canvas-auto" data-testid="mc-canvas-auto"><div className="lg:hidden"><MissionControlMobileList nodes={nodes} edges={edges} onSelectNode={onSelectNode} /></div><div className="mc-canvas-desktop hidden lg:block"><GraphPane {...graphProps} /></div></div>;
}
