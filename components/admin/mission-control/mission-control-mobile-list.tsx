"use client";

import { ExternalLink } from "lucide-react";
import { MissionControlStatusMark } from "@/components/admin/mission-control/mission-control-status-mark";
import type { MissionControlCanvasEdge, MissionControlCanvasNode } from "@/lib/mission-control/canvas-model";

type MissionControlMobileListProps = {
  nodes: MissionControlCanvasNode[];
  edges: MissionControlCanvasEdge[];
};

/**
 * Mobile/tablet graceful degrade: stable service list (no horizontal canvas).
 */
export function MissionControlMobileList({
  nodes,
  edges,
}: MissionControlMobileListProps) {
  return (
    <section className="mc-service-list" data-testid="mc-mobile-list" aria-labelledby="mc-service-list-title">
      <div className="mc-service-list__header">
        <h2 id="mc-service-list-title">Service map</h2>
        <span>{nodes.length} services</span>
      </div>
      <ul className="mc-service-list__grid" data-testid="mc-mobile-list-items">
          {nodes.map((node) => {
            const related = edges.filter(
              (edge) => edge.source === node.id || edge.target === node.id,
            );
            return (
              <li
                key={node.id}
                className="mc-service-row"
                data-testid={`mc-list-node-${node.id}`}
                data-level={node.data.level}
              >
                <div className="mc-service-row__topline">
                  <div className="min-w-0">
                    <p className="mc-service-row__name">{node.data.label}</p>
                    {node.data.placeholder ? <span className="mc-demo-label">Demo node</span> : null}
                  </div>
                  <MissionControlStatusMark level={node.data.level} />
                </div>
                <p className="mc-service-row__message">{node.data.message || "No status message"}</p>
                {node.data.href ? (
                  <a
                    href={node.data.href}
                    className="mc-service-row__link"
                    target={node.data.href.startsWith("http") ? "_blank" : undefined}
                    rel={node.data.href.startsWith("http") ? "noreferrer" : undefined}
                  >
                    <span>Open service</span><ExternalLink aria-hidden="true" />
                  </a>
                ) : null}
                {related.length > 0 ? (
                  <p className="mc-service-row__flows">
                    Flows ·{" "}
                    {related
                      .map((edge) =>
                        typeof edge.label === "string" ? edge.label : edge.id,
                      )
                      .join(", ")}
                  </p>
                ) : null}
              </li>
            );
          })}
      </ul>
    </section>
  );
}
