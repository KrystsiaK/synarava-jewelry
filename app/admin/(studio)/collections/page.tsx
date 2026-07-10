import { CollectionsCms } from "@/components/admin/collections-cms";
import { getAdminCatalogData } from "@/lib/content/catalog";

export default async function AdminCollectionsPage() {
  const { collections } = await getAdminCatalogData();

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
      <CollectionsCms collections={collections} />
    </div>
  );
}
