import { PagesCms } from "@/components/admin/pages/pages-cms";
import { LegalDocumentBackfillButton } from "@/components/admin/pages/legal-document-backfill-button";
import { getAdminCatalogData } from "@/lib/content/catalog";

export default async function AdminPagesPage() {
  const { pages } = await getAdminCatalogData();

  return (
    <div className="space-y-8">
      <div>
        <p className="adm-section-tag mb-3">[ SYN-ADM // PGS ]</p>
        <h1 className="adm-page-title">Pages</h1>
        <p className="adm-page-subtitle">
          Editorial CMS for page copy, publishing state, and route-specific hero images.
        </p>
      </div>

      <LegalDocumentBackfillButton />

      <PagesCms pages={pages} />
    </div>
  );
}
