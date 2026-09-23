import { LogoutForm } from "@/components/auth/logout-form";
import { requireAdminSession } from "@/lib/auth/admin-session";
import { db } from "@/lib/db";
import {
  AdminMobileMenu,
  AdminNav,
  AdminSmartTopbar,
  AdminThemeShell,
  AdminThemeToggle,
  AdminTopbarIssueLink,
} from "@/components/admin/shared/admin-primitives";
import { AdminToastProvider } from "@/components/admin/shared/admin-toast";
import { AdminShopifySyncSignal } from "@/components/admin/translations/admin-shopify-sync-signal";
import { BrandMark } from "@/components/ui/brand-mark";
import { getLatestReconcileDifferences, getLatestReconcileRun } from "@/lib/shopify/reconciliation-run";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireAdminSession("/admin");
  const [openIssues, latestReconcileRun, syncDifferences, syncPages] = await Promise.all([
    db.adminIssue.findMany({
      where: { status: "OPEN" },
      select: { entityType: true, targetHref: true },
    }),
    getLatestReconcileRun(),
    getLatestReconcileDifferences(),
    db.page.findMany({ select: { id: true, slug: true } }),
  ]);
  const openIssueCount = openIssues.length;
  const issueNavHrefs = Array.from(
    new Set(
      openIssues.map((issue) => {
        if (issue.entityType === "PRODUCT") return "/admin/products";
        if (issue.entityType === "COLLECTION") return "/admin/collections";
        if (issue.entityType === "PAGE") {
          if (issue.targetHref?.includes("/home")) return "/admin/pages/home";
          if (issue.targetHref?.includes("/about")) return "/admin/pages/about";
          return "/admin/pages";
        }
        if (issue.entityType === "CATEGORY") return "/admin/categories";
        if (issue.entityType === "TAG") return "/admin/tags";
        return "/admin/issues";
      }),
    ),
  );
  if (openIssueCount > 0) issueNavHrefs.push("/admin/issues");

  const syncCount = syncDifferences.length;
  const syncPageSlugs = new Map(syncPages.map((page) => [page.id, page.slug]));
  const syncNavHrefs = Array.from(
    new Set<string>(
      syncDifferences.map((difference) => {
        if (difference.rootEntityType === "PRODUCT") return "/admin/products";
        if (difference.rootEntityType === "COLLECTION") return "/admin/collections";
        if (difference.rootEntityType === "STOREFRONT_COPY") return "/admin/settings";
        const slug = syncPageSlugs.get(difference.rootEntityId);
        return slug ? `/admin/pages/${slug}` : "/admin/pages";
      }),
    ),
  );
  if (syncCount > 0) syncNavHrefs.push("/admin/translations");

  return (
    <AdminToastProvider>
      <div className="admin-terminal">
        <AdminThemeShell />

      {/* Identity rail */}
      <AdminSmartTopbar>
        <div className="min-w-0 flex items-center gap-3">
          <AdminMobileMenu
            issueCount={openIssueCount}
            issueNavHrefs={issueNavHrefs}
            syncCount={syncCount}
            syncNavHrefs={syncNavHrefs}
            footer={
              <div className="grid gap-3">
                <AdminThemeToggle />
                <LogoutForm />
              </div>
            }
          />
          <BrandMark alt="" size={32} tone="dark" className="adm-brand-mark" />
          <span className="adm-brand-kicker truncate">
            Admin console
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div className="hidden sm:block">
            <AdminThemeToggle />
          </div>
          <AdminShopifySyncSignal initialRun={latestReconcileRun} />
          <AdminTopbarIssueLink issues={openIssues} />
          <span className="adm-online-dot" />
          <span className="adm-brand-kicker hidden sm:inline">
            Live CMS
          </span>
        </div>
      </AdminSmartTopbar>

      {/* Shell */}
        <div className="admin-shell">
        {/* Left rail */}
        <aside
          className="adm-sidebar admin-sidebar-shell border-r p-5"
        >
          <div className="admin-sidebar-scroll">
            <div
              className="mb-5 border-b pb-4"
              style={{ borderColor: "var(--adm-border)" }}
            >
              <p className="adm-section-tag">Workspace</p>
              <p className="adm-title-sm mt-1.5">
                Synarava
              </p>
            </div>

            <AdminNav
              issueCount={openIssueCount}
              issueNavHrefs={issueNavHrefs}
              syncCount={syncCount}
              syncNavHrefs={syncNavHrefs}
            />
          </div>

          <div className="admin-sidebar-footer">
            <div className="flex items-center gap-2">
              <LogoutForm />
            </div>
          </div>
        </aside>

        {/* Content */}
          {/* Top padding lives on this inner wrapper, not on .admin-content
              itself: position:sticky insets are relative to the padding box
              of the nearest scrolling ancestor, so a sticky child (the
              locale tab strip) can never close a gap equal to its scroll
              container's own padding-top. Left/right/bottom padding stay on
              the scroll container since only the sticky-vs-top interaction
              is affected. */}
          <main className="admin-content px-4 pb-4 md:px-6 md:pb-6 xl:px-8 xl:pb-8">
            <div className="pt-4 md:pt-6 xl:pt-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </AdminToastProvider>
  );
}
