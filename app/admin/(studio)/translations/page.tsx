import { TranslationsCms } from "@/components/admin/translations/translations-cms";
import { db } from "@/lib/db";
import {
  getLatestReconcileDifferences,
  getLatestReconcileRun,
} from "@/lib/shopify/reconciliation-run";

export default async function AdminTranslationsPage() {
  const [run, differences, pages] = await Promise.all([
    getLatestReconcileRun(),
    getLatestReconcileDifferences(),
    db.page.findMany({ select: { id: true, slug: true } }),
  ]);
  const pageSlugs = new Map(pages.map((page) => [page.id, page.slug]));

  const rows = differences.map((difference) => {
    let href = "/admin/settings";
    if (difference.rootEntityType === "PRODUCT") href = `/admin/products/${difference.rootEntityId}`;
    if (difference.rootEntityType === "COLLECTION") href = `/admin/collections/${difference.rootEntityId}`;
    if (difference.rootEntityType === "PAGE") {
      const slug = pageSlugs.get(difference.rootEntityId);
      href = slug === "home" ? "/admin/home" : slug === "about" ? "/admin/about" : `/admin/pages/${slug ?? difference.rootEntityId}`;
    }
    return { ...difference, href };
  });

  return (
    <div className="space-y-7">
      <header>
        <h1 className="adm-page-title">Shopify sync</h1>
        <p className="adm-page-subtitle">
          Review only the translated fields that differ. Nothing is changed until you choose which version to keep.
        </p>
      </header>
      <TranslationsCms initialRun={run} differences={rows} />
    </div>
  );
}
