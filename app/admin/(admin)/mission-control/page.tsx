import { MissionControlHub } from "@/components/admin/mission-control/mission-control-hub";
import { loadMissionControlSnapshot } from "@/lib/mission-control/live-snapshot";

export const dynamic = "force-dynamic";

export default async function AdminMissionControlPage() {
  const snapshot = await loadMissionControlSnapshot();

  return (
    <div className="space-y-8">
      <div>
        <p className="adm-section-tag mb-3">[ SYN-ADM // MISSION ]</p>
        <h1 className="adm-page-title">Mission Control</h1>
        <p className="adm-page-subtitle">
          Read-only patch bay — live nodes computed at request time; placeholders
          stay gray until wired. Links only; no actions.
        </p>
      </div>

      <MissionControlHub
        nodeStatuses={snapshot.nodeStatuses}
        flowStatuses={snapshot.flowStatuses}
        nowMs={snapshot.nowMs}
        showPlaceholderNotice={snapshot.showPlaceholderNotice}
      />
    </div>
  );
}
