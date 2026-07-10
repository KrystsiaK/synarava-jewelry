import { getCurrentAdminSession } from "@/lib/auth/admin-session";

export default async function AdminAccountPage() {
  const session = await getCurrentAdminSession();

  if (!session) {
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
          Active admin session details. Credentials are managed through environment variables.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(18rem,0.65fr)]">
        <section className="adm-panel grid gap-4 p-5 md:p-6">
          <div className="space-y-2">
            <p className="adm-section-tag">[ CREDENTIAL SOURCE ]</p>
            <h2 className="adm-title-sm">Environment managed</h2>
          </div>

          <p className="text-sm leading-6" style={{ color: "var(--adm-muted)" }}>
            Admin access is intentionally separate from storefront accounts. Update
            <span className="font-semibold" style={{ color: "var(--adm-text)" }}> ADMIN_USERNAME </span>
            and
            <span className="font-semibold" style={{ color: "var(--adm-text)" }}> ADMIN_PASSWORD_HASH </span>
            in the deployment environment, then redeploy or restart the app.
          </p>
        </section>

        <aside className="adm-panel p-5">
          <p className="adm-section-tag mb-4">[ ACTIVE SESSION ]</p>

          <div
            className="pb-5 space-y-2"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
          >
            <p className="adm-title-sm">
              Synarava Admin
            </p>
            <p className="text-sm" style={{ color: "var(--adm-muted)" }}>
              {session.username}
            </p>
          </div>

          <div className="mt-5">
            <p className="adm-section-tag mb-3">[ ACCESS ]</p>
            <div className="flex flex-wrap gap-1.5">
              <span
                className="px-2 py-1 text-[0.68rem] font-bold uppercase tracking-[0.08em]"
                style={{
                  color: "var(--adm-muted)",
                  border: "1px solid var(--adm-border)",
                  borderRadius: "999px",
                }}
              >
                full-admin
              </span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
