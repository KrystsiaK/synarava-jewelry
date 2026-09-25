import { CatalogSyncCms } from "@/components/admin/products/catalog-sync-cms";
import { ProductsCms } from "@/components/admin/products/products-cms";
import { isAdminProductAuthoringEnabled } from "@/lib/admin/catalog-authoring";
import { getAdminCatalogListMeta, listAdminProductsPage } from "@/lib/admin/list-products";
import { requireAdminSession } from "@/lib/auth/admin-session";
import { getCatalogConflictSignals } from "@/lib/shopify/catalog-conflict-signals-server";
import type { CatalogConflictSignals } from "@/lib/shopify/catalog-conflict-signals";

export default async function AdminProductsPage() {
  const session = await requireAdminSession("/admin/products");
  const authoringEnabled = isAdminProductAuthoringEnabled();

  if (!authoringEnabled) {
    const initialPage = await listAdminProductsPage({
      filters: { sort: "updated" },
      adminUsername: session.username,
    });
    return (
      <div className="space-y-8">
        <CatalogSyncCms initialPage={initialPage} />
      </div>
    );
  }

  const [initialPage, meta, conflictSignals] = await Promise.all([
    listAdminProductsPage({
      filters: { sort: "published" },
      adminUsername: session.username,
    }),
    getAdminCatalogListMeta(),
    getCatalogConflictSignals(session.username).catch((error): CatalogConflictSignals => {
      console.error("[admin-products] catalog conflict status unavailable", error);
      return { state: "failed", totalCount: null, checkedAt: null, products: {}, recentlyUpdatedProducts: {} };
    }),
  ]);

  return (
    <div className="space-y-8">
      <ProductsCms
        initialPage={initialPage}
        categories={meta.categories}
        tags={meta.tags}
        collections={meta.collections}
        initialConflictSignals={conflictSignals}
      />
    </div>
  );
}
