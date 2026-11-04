import { Check, CircleHelp, TriangleAlert, X } from "lucide-react";
import type { ServiceStatusLevel } from "@/lib/mission-control/status";

const STATUS_COPY: Record<ServiceStatusLevel, string> = {
  ok: "Operational",
  warn: "Warning",
  down: "Down",
  unknown: "Unknown",
};

export function MissionControlStatusMark({
  level,
  compact = false,
  notConnected = false,
}: {
  level: ServiceStatusLevel;
  compact?: boolean;
  /** Analytics missing env — not ok, not error. */
  notConnected?: boolean;
}) {
  if (notConnected) {
    return (
      <span
        className="mc-status-mark"
        data-level="unknown"
        data-connected="false"
        data-compact={compact ? "true" : "false"}
      >
        <CircleHelp aria-hidden="true" />
        <span>{compact ? "not connected" : "Not connected"}</span>
      </span>
    );
  }
  const Icon =
    level === "ok"
      ? Check
      : level === "warn"
        ? TriangleAlert
        : level === "down"
          ? X
          : CircleHelp;
  return (
    <span
      className="mc-status-mark"
      data-level={level}
      data-compact={compact ? "true" : "false"}
    >
      <Icon aria-hidden="true" />
      <span>{compact ? level : STATUS_COPY[level]}</span>
    </span>
  );
}
