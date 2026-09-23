import { ProductsCms } from "@/components/admin/products/products-cms";
import { getAdminCatalogData } from "@/lib/content/catalog";
import { getCatalogConflictSignals } from "@/lib/shopify/catalog-conflict-signals-server";
import type { CatalogConflictSignals } from "@/lib/shopify/catalog-conflict-signals";
import { requireAdminSession } from "@/lib/auth/admin-session";

export default async function AdminProductsPage() {
  const session = await requireAdminSession("/admin/products");
  const [catalog, conflictSignals] = await Promise.all([
    getAdminCatalogData(),
    getCatalogConflictSignals(session.username).catch((error): CatalogConflictSignals => {
      console.error("[admin-products] catalog conflict status unavailable", error);
      return { state: "failed", totalCount: null, checkedAt: null, products: {}, recentlyUpdatedProducts: {} };
    }),
  ]);
  const { products, categories, tags, collections, issues } = catalog;

  return (
    <div className="space-y-8">
      <ProductsCms
        initialProducts={products}
        categories={categories}
        tags={tags}
        collections={collections}
        issues={issues}
        initialConflictSignals={conflictSignals}
      />
    </div>
  );
}
