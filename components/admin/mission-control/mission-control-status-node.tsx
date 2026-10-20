"use client";

import type { NodeProps } from "@xyflow/react";
import { MissionControlFixGuidance } from "@/components/admin/mission-control/mission-control-fix-guidance";
import type { MissionControlCanvasNode } from "@/lib/mission-control/canvas-model";

/**
 * Read-only React Flow node — color from status level; optional outbound link only.
 * Fix guidance is clipboard/link-only — never acts on a service.
 */
export function MissionControlStatusNode({
  data,
}: NodeProps<MissionControlCanvasNode>) {
  return (
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
      {data.href ? (
        <a
          href={data.href}
          className="mt-1 inline-block text-[11px] underline"
          target={data.href.startsWith("http") ? "_blank" : undefined}
          rel={data.href.startsWith("http") ? "noreferrer" : undefined}
        >
          Open
        </a>
      ) : null}
      <MissionControlFixGuidance
        widgetKey={data.widgetKey}
        level={data.level}
        fixHint={data.fixHint}
        fixPrompt={data.fixPrompt}
      />
    </div>
  );
}
