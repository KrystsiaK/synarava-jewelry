import Link from "next/link";

import { PageEditor } from "@/components/admin/pages-cms";
import { getAdminCatalogData } from "@/lib/content/catalog";

export default async function EditPagePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { pages } = await getAdminCatalogData();
  const page = pages.find((item) => item.slug === slug);

  if (!page) {
    return (
      <div className="space-y-8">
        <div>
          <p className="adm-section-tag mb-3">[ SYN-ADM // PGS // MISSING ]</p>
          <h1 className="adm-page-title">Page not found</h1>
          <p className="adm-page-subtitle">
            The page may have been archived, deleted, or moved.
          </p>
        </div>
        <Link href="/admin/pages" className="adm-btn-primary">
          Back to pages
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="adm-section-tag mb-3">[ SYN-ADM // PGS // EDIT ]</p>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="adm-page-title">{page.title}</h1>
            <p className="adm-page-subtitle">
              Edit one page record. The page table remains separate for scanning and state actions.
            </p>
          </div>
          <Link href="/admin/pages" className="adm-btn-ghost">
            Back to pages
          </Link>
        </div>
      </div>

      <PageEditor page={page} />
    </div>
  );
}
