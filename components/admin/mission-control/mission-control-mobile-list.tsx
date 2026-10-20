"use client";

import { ExternalLink } from "lucide-react";
import { MissionControlStatusMark } from "@/components/admin/mission-control/mission-control-status-mark";
import type { MissionControlCanvasEdge, MissionControlCanvasNode } from "@/lib/mission-control/canvas-model";

type MissionControlMobileListProps = {
  nodes: MissionControlCanvasNode[];
  edges: MissionControlCanvasEdge[];
  onSelectNode?: (widgetKey: string) => void;
};

/**
 * Mobile/tablet graceful degrade: stable service list (no horizontal canvas).
 */
export function MissionControlMobileList({
  nodes,
  edges,
  onSelectNode,
}: MissionControlMobileListProps) {
  const services = nodes.filter((node) => node.type === "missionControl");
  return (
    <section className="mc-service-list" data-testid="mc-mobile-list" aria-labelledby="mc-service-list-title">
      <div className="mc-service-list__header">
        <h2 id="mc-service-list-title">Service map</h2>
        <span>{services.length} services</span>
      </div>
      <ul className="mc-service-list__grid" data-testid="mc-mobile-list-items">
          {services.map((node) => {
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
                <button className="mc-service-row__inspect" type="button" onClick={() => onSelectNode?.(node.id)} aria-label={`Inspect ${node.data.label}`}>
                <div className="mc-service-row__topline">
                  <div className="min-w-0">
                    <p className="mc-service-row__name">{node.data.label}</p>
                    <span className="mc-demo-label">{node.data.kind === "live" ? "Live" : node.data.kind === "info" ? "Reference" : "Not wired"}</span>
                  </div>
                  {node.data.kind === "live" ? <MissionControlStatusMark level={node.data.level} /> : <span className="mc-service-row__kind-state">{node.data.kind === "info" ? "Reference" : "Not wired"}</span>}
                </div>
                <p className="mc-service-row__message">{node.data.message || "No status message"}</p>
                </button>
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
                        String(edge.data?.busKey ?? edge.id),
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
