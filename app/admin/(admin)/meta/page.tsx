import { MetaHealthPanel } from "@/components/admin/meta/meta-health-panel";
import { SiteSeoEditor } from "@/components/admin/meta/site-seo-editor";
import { getSiteSeoOverrides } from "@/lib/content/site-seo";
import { getMetaHealthReport } from "@/lib/seo/meta-health";

export default async function AdminMetaPage() {
  const [overrides, health] = await Promise.all([
    getSiteSeoOverrides(),
    getMetaHealthReport(),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <p className="adm-section-tag mb-3">[ SYN-ADM // META ]</p>
        <h1 className="adm-page-title">Meta</h1>
        <p className="adm-page-subtitle">
          Global site SEO defaults and health. Per-page and catalog SEO stay on Pages, Catalog, and Collections.
        </p>
      </div>
      <MetaHealthPanel report={health} />
      <SiteSeoEditor overrides={overrides} />
    </div>
  );
}
