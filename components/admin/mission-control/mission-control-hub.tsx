"use client";

import { MissionControlCanvas } from "@/components/admin/mission-control/mission-control-canvas";
import { MISSION_CONTROL_NODE_CATALOG } from "@/lib/mission-control/node-catalog";
import {
  MISSION_CONTROL_FIXTURE_NOW,
  MISSION_CONTROL_FLOW_STATUS_FIXTURES,
  MISSION_CONTROL_NODE_STATUS_FIXTURES,
} from "@/lib/mission-control/fixtures";
import { getMissionControlWiringConfig } from "@/lib/mission-control/wiring";

/**
 * Stage 3 hub surface: WiringConfig + status fixtures → patch-bay canvas.
 * Status rows come from fixtures (no DB in Stage 3); types match `status.ts`.
 */
export function MissionControlHub() {
  const config = getMissionControlWiringConfig();

  return (
    <MissionControlCanvas
      config={config}
      catalog={MISSION_CONTROL_NODE_CATALOG}
      nodeStatuses={MISSION_CONTROL_NODE_STATUS_FIXTURES}
      flowStatuses={MISSION_CONTROL_FLOW_STATUS_FIXTURES}
      nowMs={MISSION_CONTROL_FIXTURE_NOW.getTime()}
      layout="auto"
    />
  );
}
