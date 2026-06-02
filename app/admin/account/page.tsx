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
      <header className="space-y-4">
        <p className="label-caps text-accent">Account</p>
        <h1 className="font-serif text-[3rem] leading-none md:text-[4rem]">Admin credentials</h1>
        <p className="max-w-2xl text-lg leading-8 text-foreground/68">
          Change the email login and password used to access the internal Synarava admin.
        </p>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(18rem,0.65fr)]">
        <AdminCredentialsForm currentEmail={user.email} />

        <aside className="panel p-6">
          <p className="label-caps text-muted">Current access</p>
          <div className="mt-4 space-y-3">
            <p className="font-serif text-[1.8rem]">{user.name ?? "Synarava admin"}</p>
            <p className="text-sm text-foreground/60">{user.email}</p>
          </div>

          <div className="mt-8 border-t border-stroke pt-6">
            <p className="label-caps text-muted">Permissions</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {permissions.map((permission) => (
                <span
                  key={permission}
                  className="border border-stroke px-2 py-1 text-[11px] uppercase tracking-[0.14em] text-foreground/60"
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
