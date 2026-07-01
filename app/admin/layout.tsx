import { LogoutForm } from "@/components/auth/logout-form";
import { requirePermission } from "@/lib/auth/session";
import { AdminThemeShell, AdminMobileMenu, AdminNav } from "@/components/admin/admin-primitives";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requirePermission("admin.access", "/admin");

  return (
    <div className="admin-terminal min-h-screen flex flex-col">
      <AdminThemeShell />

      {/* Identity rail */}
      <div
        className="adm-topbar shrink-0 flex items-center justify-between gap-4 border-b px-4 py-3 md:px-5"
      >
        <div className="min-w-0 flex items-center gap-3">
          <AdminMobileMenu footer={<LogoutForm />} />
          <span className="adm-brand-mark">
            SYN
          </span>
          <span className="adm-brand-kicker truncate">
            Admin studio
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="adm-online-dot" />
          <span className="adm-brand-kicker hidden sm:inline">
            Live CMS
          </span>
        </div>
      </div>

      {/* Shell */}
      <div className="flex flex-1">
        {/* Left rail */}
        <aside
          className="adm-sidebar hidden w-56 shrink-0 flex-col border-r p-4 lg:w-64 lg:p-5 md:flex"
        >
          <div
            className="mb-5 border-b pb-4"
            style={{ borderColor: "var(--adm-border)" }}
          >
            <p className="adm-section-tag">Workspace</p>
            <p className="adm-title-sm mt-1.5">
              Synarava
            </p>
          </div>

          <AdminNav />

          <div
            className="mt-auto border-t pt-5"
            style={{ borderColor: "var(--adm-border)" }}
          >
            <div className="flex items-center gap-2">
              <LogoutForm />
            </div>
          </div>
        </aside>

        {/* Content */}
        <div className="flex-1 min-w-0 p-4 md:p-6 lg:p-8">
          {children}
        </div>
      </div>
    </div>
  );
}
