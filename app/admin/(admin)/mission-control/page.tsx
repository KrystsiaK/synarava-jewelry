import { MissionControlHub } from "@/components/admin/mission-control/mission-control-hub";
import { loadMissionControlSnapshot } from "@/lib/mission-control/live-snapshot";
import { isProductionDeployment } from "@/lib/deployment-environment";

export const dynamic = "force-dynamic";

export default async function AdminMissionControlPage() {
  const snapshot = await loadMissionControlSnapshot();

  return (
    <MissionControlHub
      nodeStatuses={snapshot.nodeStatuses}
      flowStatuses={snapshot.flowStatuses}
      nowMs={snapshot.nowMs}
      collectorCheckedAt={snapshot.collectorCheckedAt}
      showPlaceholderNotice={snapshot.showPlaceholderNotice}
      placeholderNodeKeys={snapshot.placeholderNodeKeys}
      liveEnvironment={isProductionDeployment() ? "production" : "staging"}
    />
  );
}
