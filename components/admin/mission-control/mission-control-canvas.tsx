"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useReducedMotion } from "motion/react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { WidgetPortManifest } from "@synarava/wiring-engine";
import {
  buildCanvasGraph,
  type MissionControlCanvasEdge,
  type MissionControlCanvasNode,
} from "@/lib/mission-control/canvas-model";
import type {
  ServiceFlowStatusRecord,
  ServiceNodeStatusRecord,
} from "@/lib/mission-control/status";
import type { MissionControlWiringConfig } from "@/lib/mission-control/wiring";
import type { MissionControlEnvironment } from "@/lib/mission-control/wiring";
import { loadMissionControlLayout, resetMissionControlLayout, saveMissionControlLayout } from "@/lib/mission-control/layout-storage";
import { MissionControlMobileList } from "@/components/admin/mission-control/mission-control-mobile-list";
import { MissionControlStatusNode } from "@/components/admin/mission-control/mission-control-status-node";

const NODE_TYPES: NodeTypes = {
  missionControl: MissionControlStatusNode,
};

export type MissionControlCanvasLayout = "auto" | "graph" | "list";

export type MissionControlCanvasProps = {
  config: MissionControlWiringConfig;
  catalog: readonly WidgetPortManifest[];
  nodeStatuses?: readonly ServiceNodeStatusRecord[];
  flowStatuses?: readonly ServiceFlowStatusRecord[];
  nowMs?: number;
  placeholderNodeKeys?: readonly string[];
  /** Tests / SSR override. `auto` = graph on md+, list on small screens (CSS). */
  layout?: MissionControlCanvasLayout;
  environment?: MissionControlEnvironment;
  resetNonce?: number;
  onSelectNode?: (widgetKey: string) => void;
};

function GraphPane({
  nodes,
  edges,
  config,
  environment,
  resetNonce,
  onSelectNode,
}: {
  nodes: MissionControlCanvasNode[];
  edges: MissionControlCanvasEdge[];
  config: MissionControlWiringConfig;
  environment: MissionControlEnvironment;
  resetNonce: number;
  onSelectNode?: (widgetKey: string) => void;
}) {
  const reduceMotion = useReducedMotion();
  const [renderedNodes, setRenderedNodes, onNodesChange] = useNodesState(nodes);
  const renderedEdges = useMemo(
    () => edges.map((edge) => ({ ...edge, animated: Boolean(edge.animated) && !reduceMotion })),
    [edges, reduceMotion],
  );

  useEffect(() => setRenderedNodes(nodes), [nodes, setRenderedNodes]);
  useEffect(() => {
    if (!resetNonce) return;
    resetMissionControlLayout(window.localStorage, config.version, environment);
    setRenderedNodes(nodes);
  }, [resetNonce, config.version, environment, nodes, setRenderedNodes]);

  const persistNode = useCallback(() => {
    const positions = Object.fromEntries(renderedNodes.filter((node) => node.type === "missionControl").map((node) => [node.id, node.position]));
    saveMissionControlLayout(window.localStorage, config.version, environment, positions);
  }, [config.version, environment, renderedNodes]);

  return (
    <div
      className="mc-canvas-graph"
      data-testid="mc-canvas-graph"
      data-reduced-motion={reduceMotion ? "true" : "false"}
    >
      <ReactFlowProvider>
        <ReactFlow
          nodes={renderedNodes}
          edges={renderedEdges}
          nodeTypes={NODE_TYPES}
          onNodesChange={onNodesChange}
          onNodeDragStop={persistNode}
          onNodeClick={(_, node) => node.type === "missionControl" && onSelectNode?.(node.id)}
          nodesDraggable
          nodesConnectable={false}
          elementsSelectable
          edgesFocusable={false}
          nodesFocusable={false}
          panOnDrag
          zoomOnScroll
          fitView
          minZoom={0.55}
          maxZoom={1.3}
          proOptions={{ hideAttribution: false }}
        >
          <Background gap={18} size={1} />
          <MiniMap pannable zoomable ariaLabel="Architecture map overview" />
          <Controls showInteractive={false} />
        </ReactFlow>
      </ReactFlowProvider>
      {/* Expose edge animation flags for render tests without RF internals */}
      <ul className="sr-only" data-testid="mc-edge-meta" aria-hidden>
        {renderedEdges.map((edge) => (
          <li
            key={edge.id}
            data-testid={`mc-edge-${edge.id}`}
            data-animated={edge.animated ? "true" : "false"}
            data-bus={String(edge.data?.busKey ?? "")}
          />
        ))}
      </ul>
    </div>
  );
}

/**
 * Mission Control patch bay: React Flow on desktop, collapsible list on mobile.
 * Read-only — no drag-to-edit, no layout persistence.
 */
export function MissionControlCanvas({
  config,
  catalog,
  nodeStatuses = [],
  flowStatuses = [],
  nowMs,
  layout = "auto",
  environment = "production",
  resetNonce = 0,
  onSelectNode,
}: MissionControlCanvasProps) {
  const positions = useMemo(
    () => typeof window === "undefined" ? {} : loadMissionControlLayout(window.localStorage, config.version, environment),
    [config.version, environment],
  );
  const { nodes, edges } = useMemo(
    () =>
      buildCanvasGraph({
        config,
        catalog,
        nodeStatuses,
        flowStatuses,
        nowMs,
        environment,
        positions,
      }),
    [config, catalog, nodeStatuses, flowStatuses, nowMs, environment, positions],
  );

  if (layout === "list") {
    return <MissionControlMobileList nodes={nodes} edges={edges} onSelectNode={onSelectNode} />;
  }

  if (layout === "graph") {
    return <GraphPane nodes={nodes} edges={edges} config={config} environment={environment} resetNonce={resetNonce} onSelectNode={onSelectNode} />;
  }

  return (
    <div data-testid="mc-canvas-auto">
      <div className="lg:hidden">
        <MissionControlMobileList nodes={nodes} edges={edges} onSelectNode={onSelectNode} />
      </div>
      <div className="hidden lg:block">
        <GraphPane nodes={nodes} edges={edges} config={config} environment={environment} resetNonce={resetNonce} onSelectNode={onSelectNode} />
      </div>
    </div>
  );
}
