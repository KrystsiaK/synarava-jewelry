import { ProductsCms } from "@/components/admin/products/products-cms";
import { getAdminCatalogListMeta, listAdminProductsPage } from "@/lib/admin/list-products";
import {
  parseAdminProductsListState,
  toAdminProductListFilters,
} from "@/lib/admin/products-list-state";
import { getCatalogConflictSignals } from "@/lib/shopify/catalog-conflict-signals-server";
import type { CatalogConflictSignals } from "@/lib/shopify/catalog-conflict-signals";
import { requireAdminSession } from "@/lib/auth/admin-session";

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminProductsPage({ searchParams }: Props) {
  const session = await requireAdminSession("/admin/products");
  const rawParams = (await searchParams) ?? {};
  const listState = parseAdminProductsListState(rawParams);
  const filters = toAdminProductListFilters(listState);

  const [initialPage, meta, conflictSignals] = await Promise.all([
    listAdminProductsPage({
      filters,
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
        initialListState={listState}
      />
    </div>
  );
}
