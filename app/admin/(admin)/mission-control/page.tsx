import { MissionControlHub } from "@/components/admin/mission-control/mission-control-hub";

export default function AdminMissionControlPage() {
  return (
    <div className="space-y-8">
      <div>
        <p className="adm-section-tag mb-3">[ SYN-ADM // MISSION ]</p>
        <h1 className="adm-page-title">Mission Control</h1>
        <p className="adm-page-subtitle">
          Read-only patch bay — nodes from{" "}
          <code className="text-xs">WiringConfig</code>, colors from status
          level, live edges when <code className="text-xs">lastFlowAt</code> is
          fresh. Links only; no actions.
        </p>
      </div>

      <MissionControlHub />
    </div>
  );
}
