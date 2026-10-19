"use client";

import { useMemo } from "react";
import {
  Background,
  ReactFlow,
  ReactFlowProvider,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { WidgetPortManifest, WiringConfig } from "@synarava/wiring-engine";
import {
  buildCanvasGraph,
  type MissionControlCanvasEdge,
  type MissionControlCanvasNode,
} from "@/lib/mission-control/canvas-model";
import type {
  ServiceFlowStatusRecord,
  ServiceNodeStatusRecord,
} from "@/lib/mission-control/status";
import { MissionControlMobileList } from "@/components/admin/mission-control/mission-control-mobile-list";
import { MissionControlStatusNode } from "@/components/admin/mission-control/mission-control-status-node";

const NODE_TYPES: NodeTypes = {
  missionControl: MissionControlStatusNode,
};

export type MissionControlCanvasLayout = "auto" | "graph" | "list";

export type MissionControlCanvasProps = {
  config: WiringConfig;
  catalog: readonly WidgetPortManifest[];
  nodeStatuses?: readonly ServiceNodeStatusRecord[];
  flowStatuses?: readonly ServiceFlowStatusRecord[];
  nowMs?: number;
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
  return (
    <div
      className="h-[28rem] w-full overflow-hidden rounded-lg border border-border-subtle bg-panel"
      data-testid="mc-canvas-graph"
    >
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          edgesFocusable={false}
          nodesFocusable={false}
          panOnDrag
          zoomOnScroll
          fitView
          minZoom={0.4}
          maxZoom={1.5}
        >
          <Background gap={18} size={1} />
        </ReactFlow>
      </ReactFlowProvider>
      {/* Expose edge animation flags for render tests without RF internals */}
      <ul className="sr-only" data-testid="mc-edge-meta" aria-hidden>
        {edges.map((edge) => (
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
}: MissionControlCanvasProps) {
  const { nodes, edges } = useMemo(
    () =>
      buildCanvasGraph({
        config,
        catalog,
        nodeStatuses,
        flowStatuses,
        nowMs,
      }),
    [config, catalog, nodeStatuses, flowStatuses, nowMs],
  );

  if (layout === "list") {
    return <MissionControlMobileList nodes={nodes} edges={edges} />;
  }

  if (layout === "graph") {
    return <GraphPane nodes={nodes} edges={edges} />;
  }

  return (
    <div data-testid="mc-canvas-auto">
      <div className="md:hidden">
        <MissionControlMobileList nodes={nodes} edges={edges} />
      </div>
      <div className="hidden md:block">
        <GraphPane nodes={nodes} edges={edges} />
      </div>
    </div>
  );
}
