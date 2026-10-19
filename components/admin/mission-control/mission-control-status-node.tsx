"use client";

import type { NodeProps } from "@xyflow/react";
import type { MissionControlCanvasNode } from "@/lib/mission-control/canvas-model";

/**
 * Read-only React Flow node — color from status level; optional outbound link only.
 */
export function MissionControlStatusNode({
  data,
}: NodeProps<MissionControlCanvasNode>) {
  const body = (
    <div
      className="min-w-[9.5rem] rounded-md border px-3 py-2 shadow-sm"
      style={{
        borderColor: data.accentColor,
        backgroundColor: `${data.accentColor}18`,
      }}
      data-testid={`mc-node-${data.widgetKey}`}
      data-level={data.level}
      data-accent={data.accentColor}
    >
      <p className="text-xs font-semibold tracking-wide text-ink">{data.label}</p>
      <p className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-ink">
        {data.level}
      </p>
      {data.message ? (
        <p className="mt-1 line-clamp-2 text-[11px] text-muted-ink">{data.message}</p>
      ) : null}
    </div>
  );

  if (data.href) {
    return (
      <a
        href={data.href}
        className="block no-underline"
        target={data.href.startsWith("http") ? "_blank" : undefined}
        rel={data.href.startsWith("http") ? "noreferrer" : undefined}
      >
        {body}
      </a>
    );
  }

  return body;
}
