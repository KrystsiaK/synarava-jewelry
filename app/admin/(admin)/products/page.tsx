import { ProductsCms } from "@/components/admin/products/products-cms";
import { getAdminCatalogListMeta, listAdminProductsPage } from "@/lib/admin/list-products";
import { getCatalogConflictSignals } from "@/lib/shopify/catalog-conflict-signals-server";
import type { CatalogConflictSignals } from "@/lib/shopify/catalog-conflict-signals";
import { requireAdminSession } from "@/lib/auth/admin-session";

export default async function AdminProductsPage() {
  const session = await requireAdminSession("/admin/products");
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
