"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { BaseWidget } from "@synarava/shell-kit";
import "@synarava/shell-kit/styles.css";
import { ExternalLink } from "lucide-react";
import { MissionControlStatusMark } from "@/components/admin/mission-control/mission-control-status-mark";
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
      className="mc-node"
      data-testid={`mc-node-${data.widgetKey}`}
      data-level={data.level}
      data-accent={data.accentColor}
    >
      <Handle type="target" position={Position.Left} isConnectable={false} aria-hidden="true" />
      <Handle type="source" position={Position.Right} isConnectable={false} aria-hidden="true" />
      <BaseWidget
        className="mc-node__widget"
        bodyClassName="mc-node__body"
        contentPaddingClassName="p-3"
        dataTestId={`mc-node-shell-${data.widgetKey}`}
        identityVisibility="settings-only"
        glassTransparency={0}
        glassShineIntensity={0}
      >
        <div className="mc-node__identity">
          <span>{data.placeholder ? "Demo node" : "Live service"}</span>
          <h3>{data.label}</h3>
        </div>
        <div className="mc-node__status-row">
          <MissionControlStatusMark level={data.level} compact />
          {data.href ? (
            <a
              href={data.href}
              className="mc-node__link nodrag nopan"
              aria-label={`Open ${data.label}`}
              target={data.href.startsWith("http") ? "_blank" : undefined}
              rel={data.href.startsWith("http") ? "noreferrer" : undefined}
            >
              <span>Open</span>
              <ExternalLink aria-hidden="true" />
            </a>
          ) : null}
        </div>
        <p className="mc-node__message" title={data.message ?? undefined}>
          {data.message || "No status message"}
        </p>
      </BaseWidget>
    </div>
  );
}
