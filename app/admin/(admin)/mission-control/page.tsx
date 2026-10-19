import { MissionControlStage1Demo } from "@/components/admin/mission-control/mission-control-stage1-demo";

export default function AdminMissionControlPage() {
  return (
    <div className="space-y-8">
      <div>
        <p className="adm-section-tag mb-3">[ SYN-ADM // MISSION ]</p>
        <h1 className="adm-page-title">Mission Control</h1>
        <p className="adm-page-subtitle">
          Stage 1 probe — published{" "}
          <code className="text-xs">@synarava/wiring-engine</code> +{" "}
          <code className="text-xs">@synarava/shell-kit</code> only. Graph and
          live nodes come in later stages.
        </p>
      </div>

      <MissionControlStage1Demo />
    </div>
  );
}
