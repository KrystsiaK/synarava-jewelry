"use client";

import { useMemo } from "react";
import { useReducedMotion } from "motion/react";
import {
  Background,
  ReactFlow,
  ReactFlowProvider,
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
};

function GraphPane({
  nodes,
  edges,
}: {
  nodes: MissionControlCanvasNode[];
  edges: MissionControlCanvasEdge[];
}) {
  const reduceMotion = useReducedMotion();
  const renderedEdges = useMemo(
    () => edges.map((edge) => ({ ...edge, animated: Boolean(edge.animated) && !reduceMotion })),
    [edges, reduceMotion],
  );

  return (
    <div
      className="mc-canvas-graph"
      data-testid="mc-canvas-graph"
      data-reduced-motion={reduceMotion ? "true" : "false"}
    >
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={renderedEdges}
          nodeTypes={NODE_TYPES}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
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
  placeholderNodeKeys = [],
  layout = "auto",
}: MissionControlCanvasProps) {
  const { nodes, edges } = useMemo(
    () =>
      buildCanvasGraph({
        config,
        catalog,
        nodeStatuses,
        flowStatuses,
        nowMs,
        placeholderNodeKeys,
      }),
    [config, catalog, nodeStatuses, flowStatuses, nowMs, placeholderNodeKeys],
  );

  if (layout === "list") {
    return <MissionControlMobileList nodes={nodes} edges={edges} />;
  }

  if (layout === "graph") {
    return <GraphPane nodes={nodes} edges={edges} />;
  }

  return (
    <div data-testid="mc-canvas-auto">
      <div className="lg:hidden">
        <MissionControlMobileList nodes={nodes} edges={edges} />
      </div>
      <div className="hidden lg:block">
        <GraphPane nodes={nodes} edges={edges} />
      </div>
    </div>
  );
}
