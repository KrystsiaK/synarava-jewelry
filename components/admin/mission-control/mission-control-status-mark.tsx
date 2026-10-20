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
}: {
  level: ServiceStatusLevel;
  compact?: boolean;
}) {
  const Icon = level === "ok" ? Check : level === "warn" ? TriangleAlert : level === "down" ? X : CircleHelp;
  return (
    <span className="mc-status-mark" data-level={level} data-compact={compact ? "true" : "false"}>
      <Icon aria-hidden="true" />
      <span>{compact ? level : STATUS_COPY[level]}</span>
    </span>
  );
}
