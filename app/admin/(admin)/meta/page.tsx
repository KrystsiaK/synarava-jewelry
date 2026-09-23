import { SiteSeoEditor } from "@/components/admin/meta/site-seo-editor";
import { getSiteSeoOverrides } from "@/lib/content/site-seo";

export default async function AdminMetaPage() {
  const overrides = await getSiteSeoOverrides();

  return (
    <div className="space-y-8">
      <div>
        <p className="adm-section-tag mb-3">[ SYN-ADM // META ]</p>
        <h1 className="adm-page-title">Meta</h1>
        <p className="adm-page-subtitle">
          Global site SEO defaults. Per-page and product SEO stay on Pages and Catalog.
        </p>
      </div>
      <SiteSeoEditor overrides={overrides} />
    </div>
  );
}
