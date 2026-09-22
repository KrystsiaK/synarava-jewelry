import Link from "next/link";

import { PageEditRoute } from "@/components/admin/pages/page-route-editor";
import { AdminSyncInlineWarning } from "@/components/admin/translations/admin-sync-inline-warning";
import { getAdminCatalogData } from "@/lib/content/catalog";
import { getLatestReconcileDifferences } from "@/lib/shopify/reconciliation-run";
import { getAdminTranslationLocales } from "@/lib/i18n/admin-translation-locales";

export default async function EditPagePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [{ pages, products }, syncDifferences, translationLocales] = await Promise.all([
    getAdminCatalogData(),
    getLatestReconcileDifferences(),
    getAdminTranslationLocales(),
  ]);
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
        <AdminSyncInlineWarning
          className="mt-4"
          differences={syncDifferences.filter(
            (difference) => difference.rootEntityType === "PAGE" && difference.rootEntityId === page.id,
          )}
        />
      </div>

      <PageEditRoute
        page={page}
        productOptions={page.slug === "home" ? products
          .filter((product) => product.status === "ACTIVE" && product.visibility === "PUBLIC")
          .map((product) => ({ id: product.id, title: product.name, slug: product.slug })) : undefined}
        translationLocales={translationLocales}
      />
    </div>
  );
}
