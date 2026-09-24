import { InfrastructureDashboard } from "@/components/admin/infrastructure/infrastructure-dashboard";
import { getInfrastructureStatus } from "@/lib/admin/infrastructure-status";

export default async function AdminInfrastructurePage() {
  const status = await getInfrastructureStatus();

  return (
    <div className="space-y-8">
      <div>
        <p className="adm-section-tag mb-3">[ SYN-ADM // INFRA ]</p>
        <h1 className="adm-page-title">Infrastructure</h1>
        <p className="adm-page-subtitle">
          Railway Postgres and S3 bucket health. Read-only probes — no credential rotation and no
          dead-file audit.
        </p>
      </div>

      <InfrastructureDashboard status={status} />
    </div>
  );
}
