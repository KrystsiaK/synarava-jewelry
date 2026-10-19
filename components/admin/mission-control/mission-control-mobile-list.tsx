"use client";

import { useState } from "react";
import type { MissionControlCanvasEdge, MissionControlCanvasNode } from "@/lib/mission-control/canvas-model";

type MissionControlMobileListProps = {
  nodes: MissionControlCanvasNode[];
  edges: MissionControlCanvasEdge[];
};

/**
 * Mobile graceful degrade: collapsible node list (no React Flow canvas).
 */
export function MissionControlMobileList({
  nodes,
  edges,
}: MissionControlMobileListProps) {
  const [open, setOpen] = useState(true);

  return (
    <div
      className="rounded-lg border border-border-subtle bg-panel"
      data-testid="mc-mobile-list"
    >
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-ink"
        aria-expanded={open}
        data-testid="mc-mobile-list-toggle"
        onClick={() => setOpen((prev) => !prev)}
      >
        <span>Services ({nodes.length})</span>
        <span className="text-xs text-muted-ink">{open ? "Hide" : "Show"}</span>
      </button>
      {open ? (
        <ul className="space-y-2 border-t border-border-subtle px-4 py-3" data-testid="mc-mobile-list-items">
          {nodes.map((node) => {
            const related = edges.filter(
              (edge) => edge.source === node.id || edge.target === node.id,
            );
            return (
              <li
                key={node.id}
                className="rounded-md border px-3 py-2"
                style={{
                  borderColor: node.data.accentColor,
                  backgroundColor: `${node.data.accentColor}14`,
                }}
                data-testid={`mc-list-node-${node.id}`}
                data-level={node.data.level}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-ink">{node.data.label}</span>
                  <span className="text-[10px] uppercase tracking-wider text-muted-ink">
                    {node.data.level}
                  </span>
                </div>
                {node.data.message ? (
                  <p className="mt-1 text-xs text-muted-ink">{node.data.message}</p>
                ) : null}
                {node.data.href ? (
                  <a
                    href={node.data.href}
                    className="mt-1 inline-block text-xs underline"
                    target={node.data.href.startsWith("http") ? "_blank" : undefined}
                    rel={node.data.href.startsWith("http") ? "noreferrer" : undefined}
                  >
                    Open
                  </a>
                ) : null}
                {related.length > 0 ? (
                  <p className="mt-1 text-[11px] text-muted-ink">
                    Links:{" "}
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
      ) : null}
    </div>
  );
}
