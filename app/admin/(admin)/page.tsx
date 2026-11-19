import Link from "next/link";

import { getAdminCatalogData } from "@/lib/content/catalog";
import { analyticsHomeBadgeFromStatus } from "@/lib/mission-control/analytics/admin-home-badge";
import { ANALYTICS_NODE_KEY } from "@/lib/mission-control/analytics/types";
import { readServiceNodeStatus } from "@/lib/mission-control/status";
import { countPendingProductReviews } from "@/lib/reviews/queries";

export default async function AdminDashboardPage() {
  const [{ pages, products, collections }, pendingReviews, analyticsStatus] =
    await Promise.all([
      getAdminCatalogData(),
      countPendingProductReviews().catch(() => 0),
      // Persisted collector row only — never re-poll GA from the admin home.
      readServiceNodeStatus(ANALYTICS_NODE_KEY).catch((error) => {
        console.error("[admin-home] analytics node status unavailable", error);
        return null;
      }),
    ]);
  const analyticsBadge = analyticsHomeBadgeFromStatus(analyticsStatus);

  const publishedProducts = products.filter(
    (p) => p.status === "ACTIVE" && p.visibility === "PUBLIC",
  );
  const publishedCollections = collections.filter(
    (c) => c.status === "ACTIVE" && c.visibility === "PUBLIC",
  );

  const stats = [
    { label: "Pages", value: pages.length, href: "/admin/pages", code: "PGS" },
    { label: "Products", value: products.length, href: "/admin/products", code: "CAT" },
    { label: "Collections", value: collections.length, href: "/admin/collections", code: "COL" },
    { label: "Pending reviews", value: pendingReviews, href: "/admin/reviews", code: "REV" },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <p className="adm-section-tag mb-3">[ SYN-ADM // CTRL ]</p>
        <h1 className="adm-page-title">
          Control Room
        </h1>
        <p className="adm-page-subtitle">
          Store management interface for catalog, editorial pages, collections, and publish readiness.
        </p>
        {analyticsBadge.kind === "alert" ? (
          <p className="adm-analytics-home-badge" data-level={analyticsBadge.level}>
            <Link href={analyticsBadge.href}>{analyticsBadge.label}</Link>
          </p>
        ) : null}
        {analyticsBadge.kind === "disconnected" ? (
          <p className="adm-analytics-home-badge adm-analytics-home-badge--muted">
            {analyticsBadge.label}
          </p>
        ) : null}
      </div>

      {/* Stat grid */}
      <div
        className="grid grid-cols-2 gap-3 md:grid-cols-4"
      >
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href} className="adm-stat-card">
            <p className="adm-section-tag">{stat.code}</p>
            <p
              className="text-[2.5rem] font-semibold leading-none tracking-[-0.02em]"
              style={{ color: "var(--adm-ink)" }}
            >
              {String(stat.value).padStart(2, "0")}
            </p>
            <p
              className="text-[0.68rem] font-bold uppercase tracking-[0.08em]"
              style={{ color: "var(--adm-muted)" }}
            >
              {stat.label}
            </p>
          </Link>
        ))}
      </div>

      {/* Status row */}
      <div
        className="grid grid-cols-2 gap-3 md:grid-cols-4"
      >
        {[
          { label: "Products live", value: String(publishedProducts.length).padStart(2, "0"), color: "var(--adm-success)" },
          { label: "Products draft", value: String(products.length - publishedProducts.length).padStart(2, "0"), color: "var(--adm-subtle)" },
          { label: "Collections live", value: String(publishedCollections.length).padStart(2, "0"), color: "var(--adm-success)" },
          { label: "Active locale", value: "EN", color: "var(--adm-accent)" },
        ].map((item) => (
          <div
            key={item.label}
            className="adm-panel p-4"
          >
            <p className="adm-section-tag">{item.label}</p>
            <p
              className="mt-2 text-xl font-semibold tracking-[0.02em]"
              style={{ color: item.color }}
            >
              {item.value}
            </p>
          </div>
        ))}
      </div>

      {/* Lists */}
      <div
        className="grid gap-px md:grid-cols-2"
        style={{ background: "color-mix(in srgb, var(--adm-ink) 4%, transparent)" }}
      >
        {/* Pages list */}
        <div className="adm-panel p-5">
          <div
            className="flex items-center justify-between mb-4 pb-3"
            style={{ borderBottom: "1px solid var(--adm-border)" }}
          >
            <p className="adm-section-tag">[ PAGES LIST ]</p>
            <Link href="/admin/pages" className="adm-btn-ghost py-1 px-2 text-[0.58rem]">
              Edit all
            </Link>
          </div>
          <div>
            {pages.map((page, i) => (
              <div key={page.id} className="adm-data-row">
                <div>
                  <p
                    className="text-sm font-semibold"
                    style={{ color: "var(--adm-ink)" }}
                  >
                    {page.title}
                  </p>
                  <p
                    className="mt-0.5 text-xs"
                    style={{ color: "var(--adm-muted)" }}
                  >
                    /{page.slug}
                  </p>
                </div>
                <span
                  className="text-[0.62rem] font-bold uppercase tracking-[0.08em]"
                  style={{ color: "var(--adm-subtle)" }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Catalog list */}
        <div className="adm-panel p-5">
          <div
            className="flex items-center justify-between mb-4 pb-3"
            style={{ borderBottom: "1px solid var(--adm-border)" }}
          >
            <p className="adm-section-tag">[ CATALOG LIST ]</p>
            <Link href="/admin/products" className="adm-btn-ghost py-1 px-2 text-[0.58rem]">
              Edit all
            </Link>
          </div>
          <div>
            {products.slice(0, 7).map((product) => {
              const published =
                product.status === "ACTIVE" && product.visibility === "PUBLIC";
              return (
                <div key={product.id} className="adm-data-row">
                  <div>
                    <p
                      className="text-sm font-semibold"
                      style={{ color: "var(--adm-ink)" }}
                    >
                      {product.name}
                    </p>
                    <p
                      className="mt-0.5 text-xs"
                      style={{ color: "var(--adm-muted)" }}
                    >
                      /{product.slug}
                    </p>
                  </div>
                  <span className={published ? "adm-badge-published" : "adm-badge-draft"}>
                    {published ? "PUB" : "DRF"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
