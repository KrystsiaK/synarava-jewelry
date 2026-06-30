import { AdminCredentialsForm } from "@/components/auth/admin-credentials-form";
import { getCurrentUser, getCurrentUserPermissions } from "@/lib/auth/session";

export default async function AdminAccountPage() {
  const user = await getCurrentUser();
  const permissions = await getCurrentUserPermissions();

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="adm-section-tag mb-3">[ SYN-ADM // ACC ]</p>
        <h1 className="adm-page-title">
          Account
        </h1>
        <p className="adm-page-subtitle">
          Access credentials, active session details, and permission visibility.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(18rem,0.65fr)]">
        <AdminCredentialsForm currentEmail={user.email} />

        <aside className="adm-panel p-5">
          <p className="adm-section-tag mb-4">[ ACTIVE SESSION ]</p>

          <div
            className="pb-5 space-y-2"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
          >
            <p className="adm-title-sm">
              {user.name ?? "Synarava Admin"}
            </p>
            <p className="text-sm" style={{ color: "var(--adm-muted)" }}>
              {user.email}
            </p>
          </div>

          <div className="mt-5">
            <p className="adm-section-tag mb-3">[ PERMISSIONS ]</p>
            <div className="flex flex-wrap gap-1.5">
              {permissions.map((permission) => (
                <span
                  key={permission}
                  className="px-2 py-1 text-[0.68rem] font-bold uppercase tracking-[0.08em]"
                  style={{
                    color: "var(--adm-muted)",
                    border: "1px solid var(--adm-border)",
                    borderRadius: "999px",
                  }}
                >
                  {permission}
                </span>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
