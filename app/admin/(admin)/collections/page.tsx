import { CollectionsCms } from "@/components/admin/collections/collections-cms";
import { getAdminCatalogData } from "@/lib/content/catalog";
import type { CatalogConflictSignals } from "@/lib/shopify/catalog-conflict-signals";
import { getCollectionConflictSignals } from "@/lib/shopify/catalog-conflict-signals-server";

export default async function AdminCollectionsPage() {
  const [{ collections }, conflictSignals] = await Promise.all([
    getAdminCatalogData(),
    getCollectionConflictSignals().catch((error): CatalogConflictSignals => {
      console.error("[admin/collections] conflict signals failed", error);
      return {
        state: "failed",
        totalCount: null,
        checkedAt: null,
        products: {},
        recentlyUpdatedProducts: {},
      };
    }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <p className="adm-section-tag mb-3">[ SYN-ADM // COL ]</p>
        <h1 className="adm-page-title">
          Collections
        </h1>
        <p className="adm-page-subtitle">
          Collection heroes, editorial copy, symbolism, product grouping, and publish state.
        </p>
      </div>
      <CollectionsCms collections={collections} initialConflictSignals={conflictSignals} />
    </div>
  );
}
