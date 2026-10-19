"use client";

import { MissionControlCanvas } from "@/components/admin/mission-control/mission-control-canvas";
import { MISSION_CONTROL_NODE_CATALOG } from "@/lib/mission-control/node-catalog";
import {
  MISSION_CONTROL_FIXTURE_NOW,
  MISSION_CONTROL_FLOW_STATUS_FIXTURES,
  MISSION_CONTROL_NODE_STATUS_FIXTURES,
} from "@/lib/mission-control/fixtures";
import { getMissionControlWiringConfig } from "@/lib/mission-control/wiring";

/** Shown whenever the hub paints fixture statuses (Stage 3 — not live DB). */
export const MISSION_CONTROL_FIXTURE_NOTICE =
  "Demo data. Live statuses arrive in Stage 4.";

/**
 * Stage 3 hub surface: WiringConfig + status fixtures → patch-bay canvas.
 * Status rows come from fixtures (no DB in Stage 3); types match `status.ts`.
 */
export function MissionControlHub() {
  const config = getMissionControlWiringConfig();

  return (
    <div className="space-y-4">
      <p
        className="rounded-md border border-[var(--adm-border)] bg-[var(--adm-panel)] px-3 py-2 text-sm text-[var(--adm-ink)]"
        role="status"
        data-testid="mc-fixture-notice"
      >
        {MISSION_CONTROL_FIXTURE_NOTICE}
      </p>
      <MissionControlCanvas
        config={config}
        catalog={MISSION_CONTROL_NODE_CATALOG}
        nodeStatuses={MISSION_CONTROL_NODE_STATUS_FIXTURES}
        flowStatuses={MISSION_CONTROL_FLOW_STATUS_FIXTURES}
        nowMs={MISSION_CONTROL_FIXTURE_NOW.getTime()}
        layout="auto"
      />
    </div>
  );
}
