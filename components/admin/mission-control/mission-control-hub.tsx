"use client";

import { MissionControlCanvas } from "@/components/admin/mission-control/mission-control-canvas";
import { MISSION_CONTROL_NODE_CATALOG } from "@/lib/mission-control/node-catalog";
import type {
  ServiceFlowStatusRecord,
  ServiceNodeStatusRecord,
} from "@/lib/mission-control/status";
import { getMissionControlWiringConfig } from "@/lib/mission-control/wiring";

/**
 * Shown while any catalog node still uses fixture/placeholder data.
 * Live Stage 4 nodes (site-health, shopify-sync, orders) never trigger this alone.
 */
export const MISSION_CONTROL_PLACEHOLDER_NOTICE =
  "Placeholder nodes still use demo data. Live: site-health, shopify-sync, orders.";

/** @deprecated Use MISSION_CONTROL_PLACEHOLDER_NOTICE */
export const MISSION_CONTROL_FIXTURE_NOTICE = MISSION_CONTROL_PLACEHOLDER_NOTICE;

export type MissionControlHubProps = {
  nodeStatuses: readonly ServiceNodeStatusRecord[];
  flowStatuses: readonly ServiceFlowStatusRecord[];
  nowMs: number;
  /** When false, live-only snapshot — no demo notice. */
  showPlaceholderNotice?: boolean;
};

/**
 * Stage 4 hub: WiringConfig + request-time statuses → patch-bay canvas.
 * Live nodes come from providers; placeholders remain fixtures until wired.
 */
export function MissionControlHub({
  nodeStatuses,
  flowStatuses,
  nowMs,
  showPlaceholderNotice = false,
}: MissionControlHubProps) {
  const config = getMissionControlWiringConfig();

  return (
    <div className="space-y-4">
      {showPlaceholderNotice ? (
        <p
          className="rounded-md border border-[var(--adm-border)] bg-[var(--adm-panel)] px-3 py-2 text-sm text-[var(--adm-ink)]"
          role="status"
          data-testid="mc-fixture-notice"
        >
          {MISSION_CONTROL_PLACEHOLDER_NOTICE}
        </p>
      ) : null}
      <MissionControlCanvas
        config={config}
        catalog={MISSION_CONTROL_NODE_CATALOG}
        nodeStatuses={nodeStatuses}
        flowStatuses={flowStatuses}
        nowMs={nowMs}
        layout="auto"
      />
    </div>
  );
}
