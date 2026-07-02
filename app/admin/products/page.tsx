import { ProductsCms } from "@/components/admin/products-cms";
import { getAdminCatalogData } from "@/lib/content/catalog";

export default async function AdminProductsPage() {
  const { products, categories, tags, collections, issues } = await getAdminCatalogData();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <p className="adm-section-tag mb-3">[ SYN-ADM // CAT ]</p>
        <h1 className="adm-page-title">
          Catalog
        </h1>
        <p className="adm-page-subtitle">
          Products, categories, tags, media, and storefront publishing state.
        </p>
      </div>

      <ProductsCms
        initialProducts={products}
        categories={categories}
        tags={tags}
        collections={collections}
        issues={issues}
      />
    </div>
  );
}
